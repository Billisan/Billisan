package dev.billisan.inventory;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class InventoryQueryRepository {

	private final JdbcTemplate jdbcTemplate;

	public InventoryQueryRepository(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	public Optional<StationInventorySummary> findStationInventorySummary(
		String stationId
	) {
		List<StationInventorySummary> summaries = jdbcTemplate.query("""
			SELECT
				st.station_id,
				COUNT(sl.slot_id) AS total_slot_count,
				COALESCE(SUM(CASE
					WHEN sl.service_status = ?
					 AND sl.occupancy_status = ?
					 AND sl.lock_status = ?
					 AND sl.item_condition = ?
					THEN 1 ELSE 0
				END), 0) AS rentable_slot_count,
				COALESCE(SUM(CASE
					WHEN sl.service_status = ? THEN 1 ELSE 0
				END), 0) AS renting_slot_count,
				COALESCE(SUM(CASE
					WHEN sl.service_status = ? THEN 1 ELSE 0
				END), 0) AS returning_slot_count,
				COALESCE(SUM(CASE
					WHEN sl.service_status = ? THEN 1 ELSE 0
				END), 0) AS admin_review_slot_count
			FROM station st
			LEFT JOIN slot sl ON sl.station_id = st.station_id
			WHERE st.station_id = ?
			GROUP BY st.station_id
			""",
			(rs, rowNumber) -> new StationInventorySummary(
				rs.getString("station_id"),
				rs.getLong("total_slot_count"),
				rs.getLong("rentable_slot_count"),
				rs.getLong("renting_slot_count"),
				rs.getLong("returning_slot_count"),
				rs.getLong("admin_review_slot_count")
			),
			SlotServiceStatus.AVAILABLE.name(),
			OccupancyStatus.OCCUPIED.name(),
			LockStatus.LOCKED.name(),
			ItemCondition.NORMAL.name(),
			SlotServiceStatus.RENTING.name(),
			SlotServiceStatus.RETURNING.name(),
			SlotServiceStatus.ADMIN_REVIEW.name(),
			stationId
		);
		return summaries.stream().findFirst();
	}

	public List<SlotView> findSlotsByStation(String stationId) {
		return jdbcTemplate.query("""
			SELECT
				slot_id,
				slot_number,
				item_condition,
				service_status,
				occupancy_status,
				lock_status,
				snapshot_recovery_reason,
				updated_at
			FROM slot
			WHERE station_id = ?
			ORDER BY slot_number
			""",
			(rs, rowNumber) -> new SlotView(
				rs.getString("slot_id"),
				rs.getInt("slot_number"),
				rs.getString("item_condition"),
				rs.getString("service_status"),
				rs.getString("occupancy_status"),
				rs.getString("lock_status"),
				rs.getString("snapshot_recovery_reason"),
				rs.getObject("updated_at", LocalDateTime.class)
			),
			stationId
		);
	}

	public Optional<AdminActivitySummary> findAdminActivitySummary(
		String stationId
	) {
		List<AdminActivitySummary> summaries = jdbcTemplate.query("""
			SELECT
				st.station_id,
				(
					SELECT COUNT(*)
					FROM rental r
					JOIN slot checkout_slot
					  ON checkout_slot.slot_id = r.checkout_slot_id
					WHERE checkout_slot.station_id = st.station_id
					  AND r.status = ?
				) AS active_rental_count,
				(
					SELECT COUNT(*)
					FROM return_attempt ra
					JOIN slot return_slot
					  ON return_slot.slot_id = ra.return_slot_id
					WHERE return_slot.station_id = st.station_id
					  AND ra.status = ?
				) AS failed_return_attempt_count,
				(
					SELECT COUNT(*)
					FROM return_attempt ra
					JOIN slot return_slot
					  ON return_slot.slot_id = ra.return_slot_id
					WHERE return_slot.station_id = st.station_id
					  AND ra.status = ?
				) AS completed_return_attempt_count,
				(
					SELECT COUNT(*)
					FROM device_operation operation
					WHERE operation.station_id = st.station_id
				) AS device_command_count,
				(
					SELECT COUNT(*)
					FROM device_operation operation
					WHERE operation.station_id = st.station_id
					  AND operation.event_id IS NOT NULL
				) AS device_event_count
			FROM station st
			WHERE st.station_id = ?
			""",
			(rs, rowNumber) -> new AdminActivitySummary(
				rs.getString("station_id"),
				rs.getLong("active_rental_count"),
				rs.getLong("failed_return_attempt_count"),
				rs.getLong("completed_return_attempt_count"),
				rs.getLong("device_command_count"),
				rs.getLong("device_event_count")
			),
			RentalStatus.ACTIVE.name(),
			ReturnAttemptStatus.FAILED.name(),
			ReturnAttemptStatus.COMPLETED.name(),
			stationId
		);
		return summaries.stream().findFirst();
	}

	public List<ReturnAttemptView> findResolvedReturnAttempts(
		String stationId
	) {
		return jdbcTemplate.query("""
			SELECT
				ra.return_attempt_id,
				ra.rental_id,
				ra.return_slot_id,
				ra.request_id,
				ra.status,
				ra.failure_reason,
				ra.created_at,
				ra.completed_at
			FROM return_attempt ra
			JOIN slot sl ON sl.slot_id = ra.return_slot_id
			WHERE sl.station_id = ?
			  AND ra.status IN (?, ?)
			ORDER BY ra.created_at, ra.return_attempt_id
			""",
			(rs, rowNumber) -> new ReturnAttemptView(
				rs.getString("return_attempt_id"),
				rs.getString("rental_id"),
				rs.getString("return_slot_id"),
				rs.getString("request_id"),
				rs.getString("status"),
				rs.getString("failure_reason"),
				rs.getObject("created_at", LocalDateTime.class),
				rs.getObject("completed_at", LocalDateTime.class)
			),
			stationId,
			ReturnAttemptStatus.FAILED.name(),
			ReturnAttemptStatus.COMPLETED.name()
		);
	}

	public List<DeviceOperationView> findDeviceOperations(String stationId) {
		return jdbcTemplate.query("""
			SELECT
				operation_id,
				slot_id,
				command_id,
				event_id,
				operation_type,
				status,
				result_code,
				requested_at,
				completed_at
			FROM device_operation
			WHERE station_id = ?
			ORDER BY requested_at, operation_id
			""",
			(rs, rowNumber) -> new DeviceOperationView(
				rs.getString("operation_id"),
				rs.getString("slot_id"),
				rs.getString("command_id"),
				rs.getString("event_id"),
				rs.getString("operation_type"),
				rs.getString("status"),
				rs.getString("result_code"),
				rs.getObject("requested_at", LocalDateTime.class),
				rs.getObject("completed_at", LocalDateTime.class)
			),
			stationId
		);
	}

	private enum SlotServiceStatus {
		AVAILABLE,
		RENTING,
		RETURNING,
		ADMIN_REVIEW
	}

	private enum OccupancyStatus {
		OCCUPIED
	}

	private enum LockStatus {
		LOCKED
	}

	private enum ItemCondition {
		NORMAL
	}

	private enum RentalStatus {
		ACTIVE
	}

	private enum ReturnAttemptStatus {
		FAILED,
		COMPLETED
	}

	public record StationInventorySummary(
		String stationId,
		long totalSlotCount,
		long rentableSlotCount,
		long rentingSlotCount,
		long returningSlotCount,
		long adminReviewSlotCount
	) {
	}

	public record SlotView(
		String slotId,
		int slotNumber,
		String itemCondition,
		String serviceStatus,
		String occupancyStatus,
		String lockStatus,
		String recoveryReason,
		LocalDateTime updatedAt
	) {
	}

	public record AdminActivitySummary(
		String stationId,
		long activeRentalCount,
		long failedReturnAttemptCount,
		long completedReturnAttemptCount,
		long deviceCommandCount,
		long deviceEventCount
	) {
	}

	public record ReturnAttemptView(
		String returnAttemptId,
		String rentalId,
		String returnSlotId,
		String requestId,
		String status,
		String failureReason,
		LocalDateTime createdAt,
		LocalDateTime completedAt
	) {
	}

	public record DeviceOperationView(
		String operationId,
		String slotId,
		String commandId,
		String eventId,
		String operationType,
		String status,
		String resultCode,
		LocalDateTime requestedAt,
		LocalDateTime completedAt
	) {
	}
}
