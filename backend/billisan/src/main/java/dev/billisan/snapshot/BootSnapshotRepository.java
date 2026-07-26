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
				last_boot_id,
				last_boot_snapshot_hash,
				last_boot_snapshot_at,
				snapshot_recovery_reason,
				snapshot_recovery_boot_id
			FROM station
			WHERE station_id = ?
			FOR UPDATE
			""",
			(rs, rowNumber) -> new StationRow(
				rs.getString("station_id"),
				rs.getString("service_status"),
				rs.getString("device_status"),
				rs.getString("last_boot_id"),
				rs.getString("last_boot_snapshot_hash"),
				rs.getObject("last_boot_snapshot_at", LocalDateTime.class),
				rs.getString("snapshot_recovery_reason"),
				rs.getString("snapshot_recovery_boot_id")
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
				service_status,
				occupancy_status,
				lock_status,
				snapshot_recovery_reason,
				snapshot_recovery_boot_id
			FROM slot
			WHERE station_id = ?
			ORDER BY slot_number
			FOR UPDATE
			""",
			(rs, rowNumber) -> new SlotRow(
				rs.getString("slot_id"),
				rs.getInt("slot_number"),
				rs.getString("service_status"),
				rs.getString("occupancy_status"),
				rs.getString("lock_status"),
				rs.getString("snapshot_recovery_reason"),
				rs.getString("snapshot_recovery_boot_id")
			),
			stationId
		);
	}

	void recordSnapshot(
		String stationId,
		String bootId,
		String snapshotHash,
		LocalDateTime measuredAt,
		LocalDateTime updatedAt
	) {
		jdbcTemplate.update("""
			UPDATE station
			SET last_boot_id = ?,
			    last_boot_snapshot_hash = ?,
			    last_boot_snapshot_at = ?,
			    last_seen_at = CASE
			        WHEN last_seen_at IS NULL OR last_seen_at < ? THEN ?
			        ELSE last_seen_at
			    END,
			    updated_at = ?
			WHERE station_id = ?
			""",
			bootId,
			snapshotHash,
			measuredAt,
			measuredAt,
			measuredAt,
			updatedAt,
			stationId
		);
	}

	void markStationRecovery(
		String stationId,
		String bootId,
		String reason,
		LocalDateTime updatedAt
	) {
		jdbcTemplate.update("""
			UPDATE station
			SET service_status = 'MAINTENANCE',
			    device_status = 'ERROR',
			    snapshot_recovery_reason = ?,
			    snapshot_recovery_boot_id = ?,
			    updated_at = ?
			WHERE station_id = ?
			""",
			reason,
			bootId,
			updatedAt,
			stationId
		);
	}

	void markSlotRecovery(
		String stationId,
		String slotId,
		String bootId,
		String reason,
		LocalDateTime updatedAt
	) {
		jdbcTemplate.update("""
			UPDATE slot
			SET service_status = 'ADMIN_REVIEW',
			    snapshot_recovery_reason = ?,
			    snapshot_recovery_boot_id = ?,
			    updated_at = ?
			WHERE station_id = ?
			  AND slot_id = ?
			""",
			reason,
			bootId,
			updatedAt,
			stationId,
			slotId
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
		String lastBootId,
		String lastBootSnapshotHash,
		LocalDateTime lastBootSnapshotAt,
		String snapshotRecoveryReason,
		String snapshotRecoveryBootId
	) {
		boolean hasSnapshotRecovery() {
			return snapshotRecoveryReason != null;
		}
	}

	record SlotRow(
		String slotId,
		int slotNumber,
		String serviceStatus,
		String occupancyStatus,
		String lockStatus,
		String snapshotRecoveryReason,
		String snapshotRecoveryBootId
	) {
		boolean hasSnapshotRecovery() {
			return snapshotRecoveryReason != null;
		}
	}
}
