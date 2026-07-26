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
			SELECT slot_id
			FROM slot FORCE INDEX (idx_slot_station_allocation_candidate)
			WHERE station_id = ?
			  AND service_status = 'AVAILABLE'
			  AND occupancy_status = 'OCCUPIED'
			  AND lock_status = 'LOCKED'
			  AND item_condition = 'NORMAL'
			ORDER BY slot_number
			LIMIT 1
			FOR UPDATE SKIP LOCKED
			""",
			stationId
		);
	}

	Optional<String> lockNextReturnSlot(String stationId) {
		return queryOptionalSlot("""
			SELECT slot_id
			FROM slot FORCE INDEX (idx_slot_station_allocation_candidate)
			WHERE station_id = ?
			  AND service_status = 'AVAILABLE'
			  AND occupancy_status = 'EMPTY'
			  AND lock_status = 'LOCKED'
			  AND item_condition IS NULL
			ORDER BY slot_number
			LIMIT 1
			FOR UPDATE SKIP LOCKED
			""",
			stationId
		);
	}

	int markSlotRenting(String slotId, LocalDateTime updatedAt) {
		return jdbcTemplate.update("""
			UPDATE slot
			SET service_status = 'RENTING',
			    updated_at = ?
			WHERE slot_id = ?
			  AND service_status = 'AVAILABLE'
			  AND occupancy_status = 'OCCUPIED'
			  AND lock_status = 'LOCKED'
			  AND item_condition = 'NORMAL'
			""",
			updatedAt,
			slotId
		);
	}

	int markSlotReturning(String slotId, LocalDateTime updatedAt) {
		return jdbcTemplate.update("""
			UPDATE slot
			SET service_status = 'RETURNING',
			    updated_at = ?
			WHERE slot_id = ?
			  AND service_status = 'AVAILABLE'
			  AND occupancy_status = 'EMPTY'
			  AND lock_status = 'LOCKED'
			  AND item_condition IS NULL
			""",
			updatedAt,
			slotId
		);
	}

	void insertRental(
		String rentalId,
		String userId,
		String slotId,
		String rentalRequestId,
		LocalDateTime requestedAt,
		LocalDateTime dueAt
	) {
		jdbcTemplate.update("""
			INSERT INTO rental (
				rental_id,
				user_id,
				checkout_slot_id,
				rental_request_id,
				status,
				requested_at,
				due_at
			) VALUES (?, ?, ?, ?, 'REQUESTED', ?, ?)
			""",
			rentalId,
			userId,
			slotId,
			rentalRequestId,
			requestedAt,
			dueAt
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
