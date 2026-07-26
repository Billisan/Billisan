package dev.billisan.inventory;

import java.sql.Connection;
import java.sql.SQLException;
import java.time.LocalDateTime;

import javax.sql.DataSource;

import org.springframework.jdbc.core.JdbcTemplate;

final class Backend2QueryScenarioFixture {

	static final String DATABASE_NAME = "billisan_query_validation_test";
	static final String STATION_ID = "22000000-0000-0000-0000-000000000011";
	static final String SLOT_AVAILABLE_ID =
		"33000000-0000-0000-0000-000000000011";
	static final String SLOT_RENTING_ID =
		"33000000-0000-0000-0000-000000000012";
	static final String SLOT_RETURNING_ID =
		"33000000-0000-0000-0000-000000000013";
	static final String SLOT_ADMIN_REVIEW_ID =
		"33000000-0000-0000-0000-000000000014";
	static final String SLOT_EMPTY_ID =
		"33000000-0000-0000-0000-000000000015";

	private static final String USER_ONE_ID =
		"11000000-0000-0000-0000-000000000011";
	private static final String USER_TWO_ID =
		"11000000-0000-0000-0000-000000000012";
	private static final String RENTAL_ACTIVE_ID =
		"44000000-0000-0000-0000-000000000011";
	private static final String RENTAL_REQUESTED_ID =
		"44000000-0000-0000-0000-000000000012";
	private static final String RENTAL_RETURNING_ID =
		"44000000-0000-0000-0000-000000000013";
	private static final String RENTAL_COMPLETED_ID =
		"44000000-0000-0000-0000-000000000014";
	private static final String RETURN_PROCESSING_ID =
		"55000000-0000-0000-0000-000000000011";
	private static final String RETURN_FAILED_ID =
		"55000000-0000-0000-0000-000000000012";
	private static final String RETURN_COMPLETED_ID =
		"55000000-0000-0000-0000-000000000013";

	private final JdbcTemplate jdbcTemplate;
	private final DataSource dataSource;

	Backend2QueryScenarioFixture(
		JdbcTemplate jdbcTemplate,
		DataSource dataSource
	) {
		this.jdbcTemplate = jdbcTemplate;
		this.dataSource = dataSource;
	}

	void resetAndLoad() {
		assertDedicatedTestDatabase();
		deleteBusinessData();
		insertUsers();
		insertStation();
		insertSlots();
		insertRentals();
		insertReturnAttempts();
		insertDeviceOperations();
	}

	private void assertDedicatedTestDatabase() {
		try (Connection connection = dataSource.getConnection()) {
			assertDedicatedTestDatabase(connection.getCatalog());
		} catch (SQLException exception) {
			throw new IllegalStateException("Cannot verify fixture database", exception);
		}
	}

	void assertDedicatedTestDatabase(String database) {
		if (!DATABASE_NAME.equals(database)) {
			throw new IllegalStateException(
				"Fixture refuses non-test database: " + database
			);
		}
	}

	private void deleteBusinessData() {
		jdbcTemplate.update("DELETE FROM payment_attempt");
		jdbcTemplate.update("DELETE FROM settlement");
		jdbcTemplate.update("DELETE FROM device_operation");
		jdbcTemplate.update("DELETE FROM damage_inspection");
		jdbcTemplate.update("DELETE FROM return_attempt");
		jdbcTemplate.update("DELETE FROM rental");
		jdbcTemplate.update("DELETE FROM slot");
		jdbcTemplate.update("DELETE FROM station");
		jdbcTemplate.update("DELETE FROM user_account");
	}

	private void insertUsers() {
		LocalDateTime createdAt = time(8, 0);
		jdbcTemplate.update("""
			INSERT INTO user_account (
				user_id, login_id, role, account_status, face_registered,
				created_at, updated_at
			) VALUES
				(?, 'fixture-user-01', 'USER', 'ACTIVE', FALSE, ?, ?),
				(?, 'fixture-admin-01', 'ADMIN', 'ACTIVE', FALSE, ?, ?)
			""",
			USER_ONE_ID,
			createdAt,
			createdAt,
			USER_TWO_ID,
			createdAt,
			createdAt
		);
	}

	private void insertStation() {
		jdbcTemplate.update("""
			INSERT INTO station (
				station_id, station_code, name, location_text,
				service_status, device_status, last_seen_at, updated_at
			) VALUES (
				?, 'FIXTURE-STATION-01', 'TEST FIXTURE STATION',
				'NON_PRODUCTION_LOCATION', 'AVAILABLE', 'ONLINE', ?, ?
			)
			""",
			STATION_ID,
			time(9, 0),
			time(9, 0)
		);
	}

	private void insertSlots() {
		jdbcTemplate.update("""
			INSERT INTO slot (
				slot_id, station_id, slot_number, item_condition,
				service_status, occupancy_status, lock_status, updated_at
			) VALUES
				(?, ?, 1, 'NORMAL', 'AVAILABLE', 'OCCUPIED', 'LOCKED', ?),
				(?, ?, 2, 'NORMAL', 'RENTING', 'OCCUPIED', 'LOCKED', ?),
				(?, ?, 3, NULL, 'RETURNING', 'EMPTY', 'LOCKED', ?),
				(?, ?, 4, 'REVIEW_REQUIRED', 'ADMIN_REVIEW', 'OCCUPIED', 'ERROR', ?),
				(?, ?, 5, NULL, 'AVAILABLE', 'EMPTY', 'LOCKED', ?)
			""",
			SLOT_AVAILABLE_ID,
			STATION_ID,
			time(9, 1),
			SLOT_RENTING_ID,
			STATION_ID,
			time(9, 2),
			SLOT_RETURNING_ID,
			STATION_ID,
			time(9, 3),
			SLOT_ADMIN_REVIEW_ID,
			STATION_ID,
			time(9, 4),
			SLOT_EMPTY_ID,
			STATION_ID,
			time(9, 5)
		);
	}

	private void insertRentals() {
		jdbcTemplate.update("""
			INSERT INTO rental (
				rental_id, user_id, checkout_slot_id, rental_request_id,
				status, requested_at, rented_at, due_at, ended_at
			) VALUES
				(?, ?, ?, 'fixture-rental-active', 'ACTIVE', ?, ?, ?, NULL),
				(?, ?, ?, 'fixture-rental-requested', 'REQUESTED', ?, NULL, ?, NULL),
				(?, ?, ?, 'fixture-rental-returning', 'RETURNING', ?, ?, ?, NULL),
				(?, ?, ?, 'fixture-rental-completed', 'COMPLETED', ?, ?, ?, ?)
			""",
			RENTAL_ACTIVE_ID,
			USER_ONE_ID,
			SLOT_EMPTY_ID,
			time(8, 10),
			time(8, 11),
			time(8, 11).plusDays(1),
			RENTAL_REQUESTED_ID,
			USER_TWO_ID,
			SLOT_RENTING_ID,
			time(8, 20),
			time(8, 20).plusDays(1),
			RENTAL_RETURNING_ID,
			USER_ONE_ID,
			SLOT_AVAILABLE_ID,
			time(8, 30),
			time(8, 31),
			time(8, 31).plusDays(1),
			RENTAL_COMPLETED_ID,
			USER_TWO_ID,
			SLOT_RENTING_ID,
			time(7, 0),
			time(7, 1),
			time(7, 1).plusDays(1),
			time(8, 50)
		);
	}

	private void insertReturnAttempts() {
		jdbcTemplate.update("""
			INSERT INTO return_attempt (
				return_attempt_id, rental_id, return_slot_id, request_id,
				status, physical_completed_at, completed_at, failure_reason,
				created_at
			) VALUES
				(?, ?, ?, 'fixture-return-processing', 'PROCESSING',
					NULL, NULL, NULL, ?),
				(?, ?, ?, 'fixture-return-failed', 'FAILED',
					NULL, NULL, 'FIXTURE_SENSOR_TIMEOUT', ?),
				(?, ?, ?, 'fixture-return-completed', 'COMPLETED',
					?, ?, NULL, ?)
			""",
			RETURN_PROCESSING_ID,
			RENTAL_RETURNING_ID,
			SLOT_RETURNING_ID,
			time(8, 40),
			RETURN_FAILED_ID,
			RENTAL_COMPLETED_ID,
			SLOT_EMPTY_ID,
			time(8, 41),
			RETURN_COMPLETED_ID,
			RENTAL_COMPLETED_ID,
			SLOT_EMPTY_ID,
			time(8, 45),
			time(8, 46),
			time(8, 42)
		);
	}

	private void insertDeviceOperations() {
		jdbcTemplate.update("""
			INSERT INTO device_operation (
				operation_id, station_id, slot_id, rental_id,
				return_attempt_id, command_id, event_id, operation_type,
				status, result_code, requested_at, acked_at, completed_at
			) VALUES
				('99000000-0000-0000-0000-000000000011', ?, ?, ?, NULL,
					'fixture-command-requested', NULL, 'UNLOCK',
					'REQUESTED', NULL, ?, NULL, NULL),
				('99000000-0000-0000-0000-000000000012', ?, ?, ?, ?,
					'fixture-command-succeeded', 'fixture-event-succeeded', 'LOCK',
					'SUCCEEDED', 'OK', ?, ?, ?),
				('99000000-0000-0000-0000-000000000013', ?, ?, NULL, NULL,
					'fixture-command-failed', 'fixture-event-failed', 'VERIFY_SLOT',
					'FAILED', 'FIXTURE_SENSOR_ERROR', ?, ?, ?)
			""",
			STATION_ID,
			SLOT_RENTING_ID,
			RENTAL_REQUESTED_ID,
			time(9, 10),
			STATION_ID,
			SLOT_RETURNING_ID,
			RENTAL_RETURNING_ID,
			RETURN_PROCESSING_ID,
			time(9, 11),
			time(9, 11),
			time(9, 12),
			STATION_ID,
			SLOT_ADMIN_REVIEW_ID,
			time(9, 13),
			time(9, 13),
			time(9, 14)
		);
	}

	private static LocalDateTime time(int hour, int minute) {
		return LocalDateTime.of(2026, 7, 27, hour, minute);
	}
}
