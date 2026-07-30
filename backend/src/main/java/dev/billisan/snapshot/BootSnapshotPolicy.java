package dev.billisan.snapshot;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Component;

@Component
class BootSnapshotPolicy {

	Evaluation evaluate(
		List<StoredSlot> storedSlots,
		List<ObservedSlot> observedSlots
	) {
		Map<String, StoredSlot> storedById = new HashMap<>();
		for (StoredSlot stored : storedSlots) {
			storedById.put(stored.slotId(), stored);
		}
		Map<String, ObservedSlot> observedById = new HashMap<>();
		for (ObservedSlot observed : observedSlots) {
			observedById.put(observed.slotId(), observed);
		}

		List<String> unknownSlotIds = observedSlots.stream()
			.map(ObservedSlot::slotId)
			.filter(slotId -> !storedById.containsKey(slotId))
			.sorted()
			.toList();
		List<String> missingSlotIds = storedSlots.stream()
			.map(StoredSlot::slotId)
			.filter(slotId -> !observedById.containsKey(slotId))
			.sorted()
			.toList();

		List<SlotDifference> differences = new ArrayList<>();
		for (StoredSlot stored : storedSlots) {
			ObservedSlot observed = observedById.get(stored.slotId());
			if (observed == null) {
				continue;
			}

			Set<String> reasons = new LinkedHashSet<>();
			if (stored.slotNumber() != observed.slotNumber()) {
				reasons.add("SLOT_NUMBER_MISMATCH");
			}
			if (!stored.occupancyStatus().equals(observed.occupancyStatus())) {
				reasons.add("OCCUPANCY_MISMATCH");
			}
			if (!stored.lockStatus().equals(observed.lockStatus())) {
				reasons.add("LOCK_MISMATCH");
			}
			if (!"NORMAL".equals(observed.sensorHealth())) {
				reasons.add("SENSOR_UNHEALTHY");
			}
			if (!reasons.isEmpty()) {
				differences.add(new SlotDifference(
					stored.slotId(),
					List.copyOf(reasons)
				));
			}
		}
		differences.sort(Comparator.comparing(SlotDifference::slotId));

		RecoveryScope scope;
		if (!unknownSlotIds.isEmpty() || !missingSlotIds.isEmpty()) {
			scope = RecoveryScope.STATION;
		} else if (!differences.isEmpty()) {
			scope = RecoveryScope.SLOT;
		} else {
			scope = RecoveryScope.NONE;
		}
		return new Evaluation(
			List.copyOf(differences),
			unknownSlotIds,
			missingSlotIds,
			scope
		);
	}

	record StoredSlot(
		String slotId,
		int slotNumber,
		String occupancyStatus,
		String lockStatus
	) {
	}

	record ObservedSlot(
		String slotId,
		int slotNumber,
		String occupancyStatus,
		String lockStatus,
		String sensorHealth
	) {
	}

	record SlotDifference(
		String slotId,
		List<String> reasons
	) {
		String databaseReason() {
			return String.join(",", reasons);
		}
	}

	record Evaluation(
		List<SlotDifference> slotDifferences,
		List<String> unknownSlotIds,
		List<String> missingSlotIds,
		RecoveryScope scope
	) {
		boolean hasMismatch() {
			return scope != RecoveryScope.NONE;
		}

		String stationReason() {
			List<String> reasons = new ArrayList<>();
			if (!unknownSlotIds.isEmpty()) {
				reasons.add("UNKNOWN_SLOT");
			}
			if (!missingSlotIds.isEmpty()) {
				reasons.add("INCOMPLETE_SNAPSHOT");
			}
			return String.join(",", reasons);
		}

		int mismatchCount() {
			return slotDifferences.size()
				+ unknownSlotIds.size()
				+ missingSlotIds.size();
		}
	}

	enum RecoveryScope {
		NONE,
		SLOT,
		STATION
	}
}
