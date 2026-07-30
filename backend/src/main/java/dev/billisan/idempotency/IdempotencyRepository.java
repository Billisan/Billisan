package dev.billisan.idempotency;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
class IdempotencyRepository {

	private final JdbcTemplate jdbcTemplate;

	IdempotencyRepository(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	void upsertReturnAttempt(
		String returnAttemptId,
		String rentalId,
		String returnSlotId,
		String requestId,
		LocalDateTime createdAt
	) {
		jdbcTemplate.update("""
			INSERT INTO return_attempt (
				return_attempt_id,
				rental_id,
				return_slot_id,
				request_id,
				status,
				created_at
			) VALUES (?, ?, ?, ?, 'PROCESSING', ?)
			ON DUPLICATE KEY UPDATE request_id = return_attempt.request_id
			""",
			returnAttemptId,
			rentalId,
			returnSlotId,
			requestId,
			createdAt
		);
	}

	Optional<ReturnAttemptRow> findReturnAttemptByRequestId(String requestId) {
		return findReturnAttempt("""
			WHERE request_id = ?
			""", requestId);
	}

	Optional<ReturnAttemptRow> lockReturnAttemptByRequestId(String requestId) {
		return findReturnAttempt("""
			WHERE request_id = ?
			FOR UPDATE
			""", requestId);
	}

	private Optional<ReturnAttemptRow> findReturnAttempt(
		String whereClause,
		String requestId
	) {
		return queryOptional("""
			SELECT
				return_attempt_id,
				rental_id,
				return_slot_id,
				request_id,
				status,
				created_at
			FROM return_attempt
			""" + whereClause,
			(rs, rowNumber) -> new ReturnAttemptRow(
				rs.getString("return_attempt_id"),
				rs.getString("rental_id"),
				rs.getString("return_slot_id"),
				rs.getString("request_id"),
				rs.getString("status"),
				rs.getObject("created_at", LocalDateTime.class)
			),
			requestId
		);
	}

	boolean isStationBootSynchronized(String stationId, String bootId) {
		Integer count = jdbcTemplate.queryForObject("""
			SELECT COUNT(*)
			FROM station
			WHERE station_id = ?
			  AND current_boot_id = ?
			  AND boot_synced_at IS NOT NULL
			""",
			Integer.class,
			stationId,
			bootId
		);
		return count != null && count == 1;
	}

	void upsertDeviceOperation(
		String operationId,
		String stationId,
		String slotId,
		String commandId,
		String issuedBootId,
		String operationType,
		LocalDateTime requestedAt
	) {
		jdbcTemplate.update("""
			INSERT INTO device_operation (
				operation_id,
				station_id,
				slot_id,
				command_id,
				issued_boot_id,
				operation_type,
				status,
				requested_at
			) VALUES (?, ?, ?, ?, ?, ?, 'REQUESTED', ?)
			ON DUPLICATE KEY UPDATE command_id = device_operation.command_id
			""",
			operationId,
			stationId,
			slotId,
			commandId,
			issuedBootId,
			operationType,
			requestedAt
		);
	}

	Optional<DeviceOperationRow> findDeviceOperationByCommandId(String commandId) {
		return findDeviceOperation(
			"WHERE command_id = ?",
			commandId
		);
	}

	Optional<DeviceOperationRow> lockDeviceOperationByCommandId(String commandId) {
		return findDeviceOperation(
			"WHERE command_id = ? FOR UPDATE",
			commandId
		);
	}

	Optional<DeviceOperationRow> findDeviceOperationByEventId(String eventId) {
		return findDeviceOperation(
			"WHERE event_id = ?",
			eventId
		);
	}

	int completeDeviceOperation(
		String operationId,
		String eventId,
		String issuedBootId,
		String status,
		String resultCode,
		String occupancyStatus,
		String lockStatus,
		LocalDateTime completedAt
	) {
		return jdbcTemplate.update("""
			UPDATE device_operation
			SET event_id = ?,
			    status = ?,
			    terminal_event_type = ?,
			    result_code = ?,
			    observed_occupancy_status = ?,
			    observed_lock_status = ?,
			    evidence_schema_version = 1,
			    evidence_observed_at = ?,
			    evidence_payload = JSON_OBJECT(
			        'occupancyStatus', ?,
			        'lockStatus', ?,
			        'resultCode', ?
			    ),
			    completed_at = ?
			WHERE operation_id = ?
			  AND event_id IS NULL
			  AND issued_boot_id = ?
			  AND status IN ('REQUESTED', 'ACKED')
			""",
			eventId,
			status,
			"SUCCEEDED".equals(status)
				? "OPERATION_COMPLETED"
				: "OPERATION_FAILED",
			resultCode,
			occupancyStatus,
			lockStatus,
			completedAt,
			occupancyStatus,
			lockStatus,
			resultCode,
			completedAt,
			operationId,
			issuedBootId
		);
	}

	int updateSlotPhysicalState(
		String slotId,
		String occupancyStatus,
		String lockStatus,
		LocalDateTime updatedAt
	) {
		return jdbcTemplate.update("""
			UPDATE slot
			SET occupancy_status = ?,
			    lock_status = ?,
			    service_status = CASE
			        WHEN ? = 'UNKNOWN' THEN 'ADMIN_REVIEW'
			        WHEN ? = 'OCCUPIED'
			             AND item_condition = 'EMPTY'
			            THEN 'ADMIN_REVIEW'
			        WHEN ? = 'EMPTY'
			             AND service_status = 'ADMIN_REVIEW'
			            THEN 'OUT_OF_SERVICE'
			        ELSE service_status
			    END,
			    item_condition = CASE
			        WHEN ? = 'EMPTY' THEN 'EMPTY'
			        WHEN ? = 'UNKNOWN' THEN 'UNKNOWN'
			        WHEN ? = 'OCCUPIED'
			             AND service_status = 'OUT_OF_SERVICE'
			            THEN 'REPAIRABLE'
			        WHEN ? = 'OCCUPIED'
			             AND item_condition = 'EMPTY'
			            THEN 'UNKNOWN'
			        ELSE item_condition
			    END,
			    updated_at = ?
			WHERE slot_id = ?
			""",
			occupancyStatus,
			lockStatus,
			occupancyStatus,
			occupancyStatus,
			occupancyStatus,
			occupancyStatus,
			occupancyStatus,
			occupancyStatus,
			occupancyStatus,
			updatedAt,
			slotId
		);
	}

	Optional<PaymentAttemptRow> lockPaymentAttempt(String paymentAttemptId) {
		return queryOptional("""
			SELECT
				payment_attempt_id,
				settlement_id,
				creation_request_id,
				toss_order_id,
				toss_payment_key,
				amount,
				status,
				approved_at,
				completed_at
			FROM payment_attempt
			WHERE payment_attempt_id = ?
			FOR UPDATE
			""",
			(rs, rowNumber) -> new PaymentAttemptRow(
				rs.getString("payment_attempt_id"),
				rs.getString("settlement_id"),
				rs.getString("creation_request_id"),
				rs.getString("toss_order_id"),
				rs.getString("toss_payment_key"),
				rs.getLong("amount"),
				rs.getString("status"),
				rs.getObject("approved_at", LocalDateTime.class),
				rs.getObject("completed_at", LocalDateTime.class)
			),
			paymentAttemptId
		);
	}

	Optional<PaymentAttemptRow> findPaymentAttemptByPaymentKey(String paymentKey) {
		return queryOptional("""
			SELECT
				payment_attempt_id,
				settlement_id,
				creation_request_id,
				toss_order_id,
				toss_payment_key,
				amount,
				status,
				approved_at,
				completed_at
			FROM payment_attempt
			WHERE toss_payment_key = ?
			""",
			(rs, rowNumber) -> new PaymentAttemptRow(
				rs.getString("payment_attempt_id"),
				rs.getString("settlement_id"),
				rs.getString("creation_request_id"),
				rs.getString("toss_order_id"),
				rs.getString("toss_payment_key"),
				rs.getLong("amount"),
				rs.getString("status"),
				rs.getObject("approved_at", LocalDateTime.class),
				rs.getObject("completed_at", LocalDateTime.class)
			),
			paymentKey
		);
	}

	Optional<SettlementRow> lockSettlement(String settlementId) {
		return queryOptional("""
			SELECT settlement_id, amount, paid_amount, status, paid_at
			FROM settlement
			WHERE settlement_id = ?
			FOR UPDATE
			""",
			(rs, rowNumber) -> new SettlementRow(
				rs.getString("settlement_id"),
				rs.getLong("amount"),
				rs.getLong("paid_amount"),
				rs.getString("status"),
				rs.getObject("paid_at", LocalDateTime.class)
			),
			settlementId
		);
	}

	int approvePaymentAttempt(
		String paymentAttemptId,
		String paymentKey,
		LocalDateTime approvedAt
	) {
		return jdbcTemplate.update("""
			UPDATE payment_attempt
			SET toss_payment_key = ?,
			    status = 'SUCCEEDED',
			    toss_status = 'DONE',
			    approved_at = ?,
			    completed_at = ?,
			    updated_at = ?
			WHERE payment_attempt_id = ?
			  AND status = 'REQUESTED'
			  AND toss_payment_key IS NULL
			""",
			paymentKey,
			approvedAt,
			approvedAt,
			approvedAt,
			paymentAttemptId
		);
	}

	private Optional<DeviceOperationRow> findDeviceOperation(
		String condition,
		Object argument
	) {
		return queryOptional("""
			SELECT
				operation_id,
				station_id,
				slot_id,
				command_id,
				event_id,
				issued_boot_id,
				operation_type,
				status,
				terminal_event_type,
				result_code,
				observed_occupancy_status,
				observed_lock_status,
				requested_at,
				completed_at
			FROM device_operation
			""" + condition,
			(rs, rowNumber) -> new DeviceOperationRow(
				rs.getString("operation_id"),
				rs.getString("station_id"),
				rs.getString("slot_id"),
				rs.getString("command_id"),
				rs.getString("event_id"),
				rs.getString("issued_boot_id"),
				rs.getString("operation_type"),
				rs.getString("status"),
				rs.getString("terminal_event_type"),
				rs.getString("result_code"),
				rs.getString("observed_occupancy_status"),
				rs.getString("observed_lock_status"),
				rs.getObject("requested_at", LocalDateTime.class),
				rs.getObject("completed_at", LocalDateTime.class)
			),
			argument
		);
	}

	private <T> Optional<T> queryOptional(
		String sql,
		RowMapper<T> rowMapper,
		Object... arguments
	) {
		List<T> rows = jdbcTemplate.query(sql, rowMapper, arguments);
		if (rows.size() > 1) {
			throw new IllegalStateException("Expected at most one row");
		}
		return rows.stream().findFirst();
	}

	record ReturnAttemptRow(
		String returnAttemptId,
		String rentalId,
		String returnSlotId,
		String requestId,
		String status,
		LocalDateTime createdAt
	) {
	}

	record DeviceOperationRow(
		String operationId,
		String stationId,
		String slotId,
		String commandId,
		String eventId,
		String issuedBootId,
		String operationType,
		String status,
		String terminalEventType,
		String resultCode,
		String observedOccupancyStatus,
		String observedLockStatus,
		LocalDateTime requestedAt,
		LocalDateTime completedAt
	) {
	}

	record PaymentAttemptRow(
		String paymentAttemptId,
		String settlementId,
		String creationRequestId,
		String tossOrderId,
		String tossPaymentKey,
		long amount,
		String status,
		LocalDateTime approvedAt,
		LocalDateTime completedAt
	) {
	}

	record SettlementRow(
		String settlementId,
		long amount,
		long paidAmount,
		String status,
		LocalDateTime paidAt
	) {
	}
}
