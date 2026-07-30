package dev.billisan.slot;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class SlotAllocationRepository {

	private final JdbcTemplate jdbcTemplate;

	SlotAllocationRepository(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	Optional<String> lockNextRentalSlot(String stationId) {
		return queryOptionalSlot("""
			SELECT candidate.slot_id
			FROM slot candidate
			WHERE candidate.station_id = ?
			  AND candidate.service_status = 'AVAILABLE'
			  AND candidate.occupancy_status = 'OCCUPIED'
			  AND candidate.lock_status = 'LOCKED'
			  AND candidate.item_condition = 'NORMAL'
			  AND NOT EXISTS (
			      SELECT 1
			      FROM rental active_rental
			      WHERE active_rental.checkout_slot_id = candidate.slot_id
			        AND active_rental.status = 'REQUESTED'
			  )
			  AND NOT EXISTS (
			      SELECT 1
			      FROM device_operation active_operation
			      WHERE active_operation.slot_id = candidate.slot_id
			        AND active_operation.status IN ('REQUESTED', 'ACKED')
			  )
			ORDER BY candidate.slot_number
			LIMIT 1
			FOR UPDATE SKIP LOCKED
			""",
			stationId
		);
	}

	Optional<String> lockNextReturnSlot(String stationId) {
		return queryOptionalSlot("""
			SELECT candidate.slot_id
			FROM slot candidate
			WHERE candidate.station_id = ?
			  AND candidate.service_status = 'AVAILABLE'
			  AND candidate.occupancy_status = 'EMPTY'
			  AND candidate.lock_status = 'LOCKED'
			  AND candidate.item_condition = 'EMPTY'
			  AND NOT EXISTS (
			      SELECT 1
			      FROM return_attempt active_return
			      WHERE active_return.return_slot_id = candidate.slot_id
			        AND active_return.status IN (
			            'PROCESSING',
			            'PHYSICAL_DONE',
			            'RECOVERY_REQUIRED'
			        )
			  )
			  AND NOT EXISTS (
			      SELECT 1
			      FROM device_operation active_operation
			      WHERE active_operation.slot_id = candidate.slot_id
			        AND active_operation.status IN ('REQUESTED', 'ACKED')
			  )
			ORDER BY candidate.slot_number
			LIMIT 1
			FOR UPDATE SKIP LOCKED
			""",
			stationId
		);
	}

	void insertRental(
		String rentalId,
		String userId,
		String slotId,
		String rentalRequestId,
		LocalDateTime requestedAt
	) {
		jdbcTemplate.update("""
			INSERT INTO rental (
				rental_id,
				user_id,
				checkout_slot_id,
				rental_request_id,
				status,
				requested_at
			) VALUES (?, ?, ?, ?, 'REQUESTED', ?)
			""",
			rentalId,
			userId,
			slotId,
			rentalRequestId,
			requestedAt
		);
	}

	void insertReturnAttempt(
		String returnAttemptId,
		String rentalId,
		String slotId,
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
			""",
			returnAttemptId,
			rentalId,
			slotId,
			requestId,
			createdAt
		);
	}

	private Optional<String> queryOptionalSlot(String sql, String stationId) {
		List<String> slots = jdbcTemplate.query(
			sql,
			(rs, rowNumber) -> rs.getString("slot_id"),
			stationId
		);
		return slots.stream().findFirst();
	}
}
