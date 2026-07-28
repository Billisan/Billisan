package dev.billisan.snapshot;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import dev.billisan.snapshot.BootSnapshotPolicy.Evaluation;
import dev.billisan.snapshot.BootSnapshotPolicy.ObservedSlot;
import dev.billisan.snapshot.BootSnapshotPolicy.StoredSlot;
import dev.billisan.snapshot.BootSnapshotRepository.SlotRow;
import dev.billisan.snapshot.BootSnapshotRepository.StationRow;

@Service
public class BootSnapshotReconciliationService {

	private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");

	private final BootSnapshotRepository repository;
	private final BootSnapshotPolicy policy;

	public BootSnapshotReconciliationService(
		BootSnapshotRepository repository,
		BootSnapshotPolicy policy
	) {
		this.repository = repository;
		this.policy = policy;
	}

	@Transactional
	public BootSnapshotResult reconcile(BootSnapshotCommand command) {
		validate(command);

		LocalDateTime measuredAt = command
			.measuredAt()
			.atZoneSameInstant(BUSINESS_ZONE)
			.toLocalDateTime();
		StationRow station = repository
			.lockStation(command.stationId())
			.orElseThrow(() -> new BootSnapshotRejectedException(
				BootSnapshotRejectedException.Reason.UNKNOWN_STATION,
				command.stationId()
			));
		List<SlotRow> storedSlots =
			repository.lockStationSlots(command.stationId());

		Evaluation evaluation = evaluate(storedSlots, command.slots());
		if (command.bootId().equals(station.currentBootId())) {
			return result(
				command,
				station,
				storedSlots,
				evaluation,
				Outcome.REPLAYED
			);
		}
		if (!command.bootId().equals(station.currentBootId())
			&& station.lastSeenAt() != null
			&& !measuredAt.isAfter(station.lastSeenAt())) {
			throw new BootSnapshotRejectedException(
				BootSnapshotRejectedException.Reason.STALE_SNAPSHOT,
				command.bootId()
			);
		}

		LocalDateTime processedAt = now();
		if (!command.bootId().equals(station.currentBootId())) {
			repository.markPriorBootOperationsUnknown(
				command.stationId(),
				command.bootId(),
				processedAt
			);
		}
		repository.recordSnapshot(
			command.stationId(),
			command.bootId(),
			measuredAt,
			processedAt,
			!evaluation.hasMismatch()
		);

		applyRecovery(command, storedSlots, evaluation, processedAt);
		return result(
			command,
			station,
			storedSlots,
			evaluation,
			Outcome.APPLIED
		);
	}

	private Evaluation evaluate(
		List<SlotRow> storedSlots,
		List<SnapshotSlot> observedSlots
	) {
		return policy.evaluate(
			storedSlots.stream()
				.map(slot -> new StoredSlot(
					slot.slotId(),
					slot.slotNumber(),
					slot.occupancyStatus(),
					slot.lockStatus()
				))
				.toList(),
			observedSlots.stream()
				.map(slot -> new ObservedSlot(
					slot.slotId(),
					slot.slotNumber(),
					slot.occupancyStatus().name(),
					slot.lockStatus().name(),
					slot.sensorHealth().name()
				))
				.toList()
		);
	}

	private void applyRecovery(
		BootSnapshotCommand command,
		List<SlotRow> storedSlots,
		Evaluation evaluation,
		LocalDateTime processedAt
	) {
		if (evaluation.scope() == BootSnapshotPolicy.RecoveryScope.NONE) {
			return;
		}
		if (evaluation.scope() == BootSnapshotPolicy.RecoveryScope.STATION) {
			repository.markStationRecovery(
				command.stationId(),
				processedAt
			);
			for (SlotRow slot : storedSlots) {
				String reason = evaluation.slotDifferences().stream()
					.filter(difference -> difference.slotId().equals(slot.slotId()))
					.findFirst()
					.map(BootSnapshotPolicy.SlotDifference::databaseReason)
					.orElseGet(() -> evaluation.missingSlotIds().contains(slot.slotId())
						? "MISSING_FROM_SNAPSHOT"
						: "STATION_SNAPSHOT_MISMATCH");
				markSlotRecovery(command, slot.slotId(), reason, processedAt);
			}
			return;
		}

		for (BootSnapshotPolicy.SlotDifference difference
			: evaluation.slotDifferences()) {
			markSlotRecovery(
				command,
				difference.slotId(),
				difference.databaseReason(),
				processedAt
			);
		}
	}

	private void markSlotRecovery(
		BootSnapshotCommand command,
		String slotId,
		String reason,
		LocalDateTime processedAt
	) {
		repository.markSlotRecovery(
			command.stationId(),
			slotId,
			processedAt
		);
		repository.markActiveReturnRecovery(slotId);
	}

	private BootSnapshotResult result(
		BootSnapshotCommand command,
		StationRow station,
		List<SlotRow> storedSlots,
		Evaluation evaluation,
		Outcome outcome
	) {
		boolean priorStationRecovery = station.hasSnapshotRecovery();
		boolean priorSlotRecovery = storedSlots.stream()
			.anyMatch(SlotRow::hasSnapshotRecovery);
		boolean recoveryRequired = evaluation.hasMismatch()
			|| priorStationRecovery
			|| priorSlotRecovery;

		RecoveryScope recoveryScope;
		if (evaluation.scope() != BootSnapshotPolicy.RecoveryScope.NONE) {
			recoveryScope = RecoveryScope.valueOf(evaluation.scope().name());
		} else if (priorStationRecovery) {
			recoveryScope = RecoveryScope.STATION;
		} else if (priorSlotRecovery) {
			recoveryScope = RecoveryScope.SLOT;
		} else {
			recoveryScope = RecoveryScope.NONE;
		}

		List<SlotDifference> differences = evaluation.slotDifferences().stream()
			.map(difference -> new SlotDifference(
				difference.slotId(),
				difference.reasons()
			))
			.toList();
		return new BootSnapshotResult(
			command.bootId(),
			recoveryRequired
				? ReconciliationStatus.RECOVERY_REQUIRED
				: ReconciliationStatus.MATCHED,
			recoveryScope,
			outcome,
			evaluation.mismatchCount(),
			differences,
			evaluation.unknownSlotIds(),
			evaluation.missingSlotIds()
		);
	}

	private void validate(BootSnapshotCommand command) {
		Objects.requireNonNull(command, "command");
		requireUuid(command.stationId(), "stationId");
		requireUuid(command.bootId(), "bootId");
		requireUuid(command.deviceId(), "deviceId");
		Objects.requireNonNull(command.measuredAt(), "measuredAt");
		if (command.slots() == null || command.slots().isEmpty()) {
			throw new IllegalArgumentException("slots must not be empty");
		}

		Set<String> slotIds = new HashSet<>();
		for (SnapshotSlot slot : command.slots()) {
			Objects.requireNonNull(slot, "slot");
			requireUuid(slot.slotId(), "slotId");
			if (!slotIds.add(slot.slotId())) {
				throw new IllegalArgumentException("Duplicate slotId in snapshot");
			}
			if (slot.slotNumber() < 1) {
				throw new IllegalArgumentException("slotNumber must be positive");
			}
			Objects.requireNonNull(slot.occupancyStatus(), "occupancyStatus");
			Objects.requireNonNull(slot.lockStatus(), "lockStatus");
			Objects.requireNonNull(slot.sensorHealth(), "sensorHealth");
		}
	}

	private static void requireUuid(String value, String field) {
		if (value == null) {
			throw new IllegalArgumentException(field + " must not be null");
		}
		try {
			UUID parsed = UUID.fromString(value);
			if (!parsed.toString().equals(value)) {
				throw new IllegalArgumentException(field + " must be a canonical UUID");
			}
		} catch (IllegalArgumentException exception) {
			throw new IllegalArgumentException(
				field + " must be a canonical UUID",
				exception
			);
		}
	}

	private static LocalDateTime now() {
		LocalDateTime current = LocalDateTime.now(BUSINESS_ZONE);
		return current.withNano(current.getNano() / 1_000 * 1_000);
	}

	public enum OccupancyStatus {
		EMPTY,
		OCCUPIED,
		UNKNOWN
	}

	public enum LockStatus {
		LOCKED,
		UNLOCKED,
		UNKNOWN,
		ERROR
	}

	public enum SensorHealth {
		NORMAL,
		DEGRADED,
		ERROR
	}

	public enum ReconciliationStatus {
		MATCHED,
		RECOVERY_REQUIRED
	}

	public enum RecoveryScope {
		NONE,
		SLOT,
		STATION
	}

	public enum Outcome {
		APPLIED,
		REPLAYED
	}

	public record BootSnapshotCommand(
		String stationId,
		String bootId,
		String deviceId,
		OffsetDateTime measuredAt,
		List<SnapshotSlot> slots
	) {
		public BootSnapshotCommand {
			if (slots != null) {
				slots = List.copyOf(slots);
			}
		}
	}

	public record SnapshotSlot(
		String slotId,
		int slotNumber,
		OccupancyStatus occupancyStatus,
		LockStatus lockStatus,
		SensorHealth sensorHealth
	) {
	}

	public record SlotDifference(
		String slotId,
		List<String> reasons
	) {
		public SlotDifference {
			reasons = List.copyOf(reasons);
		}
	}

	public record BootSnapshotResult(
		String bootId,
		ReconciliationStatus status,
		RecoveryScope recoveryScope,
		Outcome outcome,
		int mismatchCount,
		List<SlotDifference> slotDifferences,
		List<String> unknownSlotIds,
		List<String> missingSlotIds
	) {
		public BootSnapshotResult {
			slotDifferences = List.copyOf(slotDifferences);
			unknownSlotIds = List.copyOf(unknownSlotIds);
			missingSlotIds = List.copyOf(missingSlotIds);
		}
	}
}
