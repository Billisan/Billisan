package dev.billisan.snapshot;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class BootSnapshotRepository {

	private final JdbcTemplate jdbcTemplate;

	BootSnapshotRepository(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	Optional<StationRow> lockStation(String stationId) {
		List<StationRow> stations = jdbcTemplate.query("""
			SELECT
				station_id,
				service_status,
				device_status,
				current_boot_id,
				boot_synced_at,
				last_seen_at
			FROM station
			WHERE station_id = ?
			FOR UPDATE
			""",
			(rs, rowNumber) -> new StationRow(
				rs.getString("station_id"),
				rs.getString("service_status"),
				rs.getString("device_status"),
				rs.getString("current_boot_id"),
				rs.getObject("boot_synced_at", LocalDateTime.class),
				rs.getObject("last_seen_at", LocalDateTime.class)
			),
			stationId
		);
		return stations.stream().findFirst();
	}

	List<SlotRow> lockStationSlots(String stationId) {
		return jdbcTemplate.query("""
			SELECT
				slot_id,
				slot_number,
				item_condition,
				service_status,
				occupancy_status,
				lock_status
			FROM slot
			WHERE station_id = ?
			ORDER BY slot_number
			FOR UPDATE
			""",
			(rs, rowNumber) -> new SlotRow(
				rs.getString("slot_id"),
				rs.getInt("slot_number"),
				rs.getString("item_condition"),
				rs.getString("service_status"),
				rs.getString("occupancy_status"),
				rs.getString("lock_status")
			),
			stationId
		);
	}

	void recordSnapshot(
		String stationId,
		String bootId,
		LocalDateTime measuredAt,
		LocalDateTime updatedAt,
		boolean synchronizedSnapshot
	) {
		jdbcTemplate.update("""
			UPDATE station
			SET current_boot_id = ?,
			    boot_synced_at = ?,
			    last_seen_at = CASE
			        WHEN last_seen_at IS NULL OR last_seen_at < ? THEN ?
			        ELSE last_seen_at
			    END,
			    updated_at = ?
			WHERE station_id = ?
			""",
			bootId,
			synchronizedSnapshot ? updatedAt : null,
			measuredAt,
			measuredAt,
			updatedAt,
			stationId
		);
	}

	void markStationRecovery(
		String stationId,
		LocalDateTime updatedAt
	) {
		jdbcTemplate.update("""
			UPDATE station
			SET service_status = 'MAINTENANCE',
			    device_status = 'ERROR',
			    boot_synced_at = NULL,
			    updated_at = ?
			WHERE station_id = ?
			""",
			updatedAt,
			stationId
		);
	}

	void markSlotRecovery(
		String stationId,
		String slotId,
		LocalDateTime updatedAt
	) {
		jdbcTemplate.update("""
			UPDATE slot
			SET service_status = CASE
			        WHEN occupancy_status = 'EMPTY'
			            THEN 'OUT_OF_SERVICE'
			        ELSE 'ADMIN_REVIEW'
			    END,
			    item_condition = CASE
			        WHEN occupancy_status = 'EMPTY' THEN 'EMPTY'
			        ELSE 'UNKNOWN'
			    END,
			    updated_at = ?
			WHERE station_id = ?
			  AND slot_id = ?
			""",
			updatedAt,
			stationId,
			slotId
		);
	}

	void markPriorBootOperationsUnknown(
		String stationId,
		String currentBootId,
		LocalDateTime updatedAt
	) {
		jdbcTemplate.update("""
			UPDATE device_operation
			SET status = 'OUTCOME_UNKNOWN',
			    result_code = 'PI_BOOT_CHANGED',
			    completed_at = ?
			WHERE station_id = ?
			  AND issued_boot_id <> ?
			  AND status IN ('REQUESTED', 'ACKED')
			""",
			updatedAt,
			stationId,
			currentBootId
		);
	}

	void markActiveReturnRecovery(String slotId) {
		jdbcTemplate.update("""
			UPDATE return_attempt
			SET status = 'RECOVERY_REQUIRED',
			    failure_reason = 'BOOT_SNAPSHOT_MISMATCH'
			WHERE return_slot_id = ?
			  AND status IN ('PROCESSING', 'PHYSICAL_DONE')
			""",
			slotId
		);
	}

	record StationRow(
		String stationId,
		String serviceStatus,
		String deviceStatus,
		String currentBootId,
		LocalDateTime bootSyncedAt,
		LocalDateTime lastSeenAt
	) {
		boolean hasSnapshotRecovery() {
			return "MAINTENANCE".equals(serviceStatus)
				&& "ERROR".equals(deviceStatus);
		}
	}

	record SlotRow(
		String slotId,
		int slotNumber,
		String itemCondition,
		String serviceStatus,
		String occupancyStatus,
		String lockStatus
	) {
		boolean hasSnapshotRecovery() {
			return "ADMIN_REVIEW".equals(serviceStatus)
				|| "OUT_OF_SERVICE".equals(serviceStatus);
		}
	}
}
