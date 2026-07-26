package dev.billisan.snapshot;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.dao.DuplicateKeyException;
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

		String snapshotHash = snapshotHash(command);
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

		if (command.bootId().equals(station.lastBootId())) {
			if (!snapshotHash.equals(station.lastBootSnapshotHash())) {
				throw new BootSnapshotRejectedException(
					BootSnapshotRejectedException.Reason.IDEMPOTENCY_CONFLICT,
					command.bootId()
				);
			}
			return result(
				command,
				station,
				storedSlots,
				evaluate(storedSlots, command.slots()),
				Outcome.REPLAYED
			);
		}
		if (station.lastBootSnapshotAt() != null
			&& !measuredAt.isAfter(station.lastBootSnapshotAt())) {
			throw new BootSnapshotRejectedException(
				BootSnapshotRejectedException.Reason.STALE_SNAPSHOT,
				command.bootId()
			);
		}

		Evaluation evaluation = evaluate(storedSlots, command.slots());
		LocalDateTime processedAt = now();
		try {
			repository.recordSnapshot(
				command.stationId(),
				command.bootId(),
				snapshotHash,
				measuredAt,
				processedAt
			);
		} catch (DuplicateKeyException exception) {
			throw new BootSnapshotRejectedException(
				BootSnapshotRejectedException.Reason.IDEMPOTENCY_CONFLICT,
				command.bootId(),
				exception
			);
		}

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
				command.bootId(),
				evaluation.stationReason(),
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
			command.bootId(),
			reason,
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

	private static String snapshotHash(BootSnapshotCommand command) {
		List<SnapshotSlot> sortedSlots = new ArrayList<>(command.slots());
		sortedSlots.sort(Comparator.comparing(SnapshotSlot::slotId));

		StringBuilder canonical = new StringBuilder()
			.append(command.stationId()).append('\n')
			.append(command.bootId()).append('\n')
			.append(command.deviceId()).append('\n')
			.append(command.measuredAt().toInstant()).append('\n');
		for (SnapshotSlot slot : sortedSlots) {
			canonical
				.append(slot.slotId()).append('|')
				.append(slot.slotNumber()).append('|')
				.append(slot.occupancyStatus()).append('|')
				.append(slot.lockStatus()).append('|')
				.append(slot.sensorHealth()).append('\n');
		}

		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			return HexFormat.of().formatHex(
				digest.digest(canonical.toString().getBytes(StandardCharsets.UTF_8))
			);
		} catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("SHA-256 is not available", exception);
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
