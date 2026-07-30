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

	private static final String USER_ONE_ID = "110000011";
	private static final String USER_ONE_REF =
		"11000000-0000-0000-0000-000000000011";
	private static final String USER_TWO_ID = "110000012";
	private static final String USER_TWO_REF =
		"11000000-0000-0000-0000-000000000012";
	private static final String USER_THREE_ID = "110000013";
	private static final String USER_THREE_REF =
		"11000000-0000-0000-0000-000000000013";
	private static final String USER_FOUR_ID = "110000014";
	private static final String USER_FOUR_REF =
		"11000000-0000-0000-0000-000000000014";
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
	private static final String BOOT_ID =
		"aa000000-0000-0000-0000-000000000011";

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
		truncateBusinessData();
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

	private void truncateBusinessData() {
		jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 0");
		try {
			for (String table : java.util.List.of(
				"settlement_payment_mutation_guard",
				"payment_attempt",
				"settlement",
				"device_operation",
				"damage_inspection",
				"return_attempt",
				"rental",
				"slot",
				"station",
				"face_profile_sync_operation",
				"admin_account",
				"user_account"
			)) {
				jdbcTemplate.execute("TRUNCATE TABLE " + table);
			}
		} finally {
			jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1");
		}
	}

	private void insertUsers() {
		LocalDateTime createdAt = time(8, 0);
		jdbcTemplate.update("""
			INSERT INTO user_account (
				user_id, user_ref, login_id, password_hash, name,
				face_registered, created_at, updated_at
			) VALUES
				(
					?, ?, 'fixture-user-01@example.com', '{noop}fixture-password-01',
					'Fixture User 1', FALSE, ?, ?
				),
				(
					?, ?, 'fixture-user-02@example.com', '{noop}fixture-password-02',
					'Fixture User 2', FALSE, ?, ?
				),
				(
					?, ?, 'fixture-user-03@example.com', '{noop}fixture-password-03',
					'Fixture User 3', FALSE, ?, ?
				),
				(
					?, ?, 'fixture-user-04@example.com', '{noop}fixture-password-04',
					'Fixture User 4', FALSE, ?, ?
				)
			""",
			USER_ONE_ID,
			USER_ONE_REF,
			createdAt,
			createdAt,
			USER_TWO_ID,
			USER_TWO_REF,
			createdAt,
			createdAt,
			USER_THREE_ID,
			USER_THREE_REF,
			createdAt,
			createdAt,
			USER_FOUR_ID,
			USER_FOUR_REF,
			createdAt,
			createdAt
		);
	}

	private void insertStation() {
		jdbcTemplate.update("""
			INSERT INTO station (
				station_id, name, service_status, device_status, current_boot_id,
				boot_synced_at, last_seen_at, created_at, updated_at
			) VALUES (
				?, 'TEST FIXTURE STATION',
				'AVAILABLE', 'ONLINE',
				?, ?, ?, ?, ?
			)
			""",
			STATION_ID,
			BOOT_ID,
			time(9, 0),
			time(9, 0),
			time(8, 0),
			time(9, 0)
		);
	}

	private void insertSlots() {
		jdbcTemplate.update("""
			INSERT INTO slot (
				slot_id, station_id, slot_number, item_condition,
				service_status, occupancy_status, lock_status, created_at, updated_at
			) VALUES
				(?, ?, 1, 'NORMAL', 'AVAILABLE', 'OCCUPIED', 'LOCKED', ?, ?),
				(?, ?, 2, 'NORMAL', 'AVAILABLE', 'OCCUPIED', 'LOCKED', ?, ?),
				(?, ?, 3, 'EMPTY', 'AVAILABLE', 'EMPTY', 'LOCKED', ?, ?),
				(?, ?, 4, 'UNKNOWN', 'ADMIN_REVIEW', 'OCCUPIED', 'ERROR', ?, ?),
				(?, ?, 5, 'EMPTY', 'AVAILABLE', 'EMPTY', 'LOCKED', ?, ?)
			""",
			SLOT_AVAILABLE_ID,
			STATION_ID,
			time(8, 0),
			time(9, 1),
			SLOT_RENTING_ID,
			STATION_ID,
			time(8, 0),
			time(9, 2),
			SLOT_RETURNING_ID,
			STATION_ID,
			time(8, 0),
			time(9, 3),
			SLOT_ADMIN_REVIEW_ID,
			STATION_ID,
			time(8, 0),
			time(9, 4),
			SLOT_EMPTY_ID,
			STATION_ID,
			time(8, 0),
			time(9, 5)
		);
	}

	private void insertRentals() {
		jdbcTemplate.update("""
			INSERT INTO rental (
				rental_id, user_id, checkout_slot_id, rental_request_id,
				status, requested_at, rented_at, due_at, ended_at,
				created_at, updated_at
			) VALUES
				(?, ?, ?, 'fixture-rental-active', 'ACTIVE', ?, ?, ?, NULL, ?, ?),
				(?, ?, ?, 'fixture-rental-requested', 'REQUESTED',
					?, NULL, NULL, NULL, ?, ?),
				(?, ?, ?, 'fixture-rental-returning', 'RETURNING',
					?, ?, ?, NULL, ?, ?),
				(?, ?, ?, 'fixture-rental-completed', 'RETURNING',
					?, ?, ?, NULL, ?, ?)
			""",
			RENTAL_ACTIVE_ID,
			USER_ONE_ID,
			SLOT_EMPTY_ID,
			time(8, 10),
			time(8, 11),
			time(8, 11).plusDays(1),
			time(8, 10),
			time(8, 11),
			RENTAL_REQUESTED_ID,
			USER_FOUR_ID,
			SLOT_RENTING_ID,
			time(8, 20),
			time(8, 20),
			time(8, 20),
			RENTAL_RETURNING_ID,
			USER_THREE_ID,
			SLOT_AVAILABLE_ID,
			time(8, 30),
			time(8, 31),
			time(8, 31).plusDays(1),
			time(8, 30),
			time(8, 40),
			RENTAL_COMPLETED_ID,
			USER_TWO_ID,
			SLOT_RENTING_ID,
			time(7, 0),
			time(7, 1),
			time(7, 1).plusDays(1),
			time(7, 0),
			time(8, 42)
		);
	}

	private void insertReturnAttempts() {
		jdbcTemplate.update("""
			INSERT INTO return_attempt (
				return_attempt_id, rental_id, return_slot_id, request_id,
				status, physical_completed_at, completed_at, failure_reason,
				created_at, updated_at
			) VALUES
				(?, ?, ?, 'fixture-return-processing', 'PROCESSING',
					NULL, NULL, NULL, ?, ?),
				(?, ?, ?, 'fixture-return-failed', 'FAILED',
					NULL, NULL, 'FIXTURE_SENSOR_TIMEOUT', ?, ?),
				(?, ?, ?, 'fixture-return-completed', 'COMPLETED',
					?, ?, NULL, ?, ?)
			""",
			RETURN_PROCESSING_ID,
			RENTAL_RETURNING_ID,
			SLOT_RETURNING_ID,
			time(8, 40),
			time(8, 40),
			RETURN_FAILED_ID,
			RENTAL_COMPLETED_ID,
			SLOT_EMPTY_ID,
			time(8, 41),
			time(8, 41),
			RETURN_COMPLETED_ID,
			RENTAL_COMPLETED_ID,
			SLOT_EMPTY_ID,
			time(8, 45),
			time(8, 46),
			time(8, 42),
			time(8, 46)
		);
	}

	private void insertDeviceOperations() {
		jdbcTemplate.update("""
			INSERT INTO device_operation (
				operation_id, station_id, slot_id,
				command_id, event_id, issued_boot_id,
				operation_type, status, terminal_event_type, result_code,
				observed_occupancy_status, observed_lock_status,
				evidence_schema_version, evidence_observed_at, evidence_payload,
				requested_at, acked_at, completed_at, created_at, updated_at
			) VALUES
				('99000000-0000-0000-0000-000000000011', ?, ?,
					'fixture-command-requested', NULL, ?, 'UNLOCK',
					'REQUESTED', NULL, NULL, NULL, NULL, NULL, NULL, NULL,
					?, NULL, NULL, ?, ?),
				('99000000-0000-0000-0000-000000000012', ?, ?,
					'fixture-command-succeeded', 'fixture-event-succeeded', ?,
					'LOCK', 'SUCCEEDED', 'OPERATION_COMPLETED', 'OK',
					'EMPTY', 'LOCKED', 1, ?, JSON_OBJECT('fixture', TRUE),
					?, ?, ?, ?, ?),
				('99000000-0000-0000-0000-000000000013', ?, ?,
					'fixture-command-failed', 'fixture-event-failed', ?,
					'VERIFY_SLOT', 'FAILED', 'OPERATION_FAILED',
					'FIXTURE_SENSOR_ERROR', 'OCCUPIED', 'ERROR', 1, ?,
					JSON_OBJECT('fixture', TRUE), ?, ?, ?, ?, ?)
			""",
			STATION_ID,
			SLOT_RENTING_ID,
			BOOT_ID,
			time(9, 10),
			time(9, 10),
			time(9, 10),
			STATION_ID,
			SLOT_RETURNING_ID,
			BOOT_ID,
			time(9, 12),
			time(9, 11),
			time(9, 11),
			time(9, 12),
			time(9, 11),
			time(9, 12),
			STATION_ID,
			SLOT_ADMIN_REVIEW_ID,
			BOOT_ID,
			time(9, 14),
			time(9, 13),
			time(9, 13),
			time(9, 14),
			time(9, 13),
			time(9, 14)
		);
	}

	private static LocalDateTime time(int hour, int minute) {
		return LocalDateTime.of(2026, 7, 27, hour, minute);
	}
}
