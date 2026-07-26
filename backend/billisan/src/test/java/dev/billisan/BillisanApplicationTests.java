package dev.billisan;

import java.util.List;
import java.util.Map;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.dao.DuplicateKeyException;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Testcontainers
@SpringBootTest
class BillisanApplicationTests {

	@Container
	private static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.0")
		.withDatabaseName("billisan_test")
		.withUsername("billisan")
		.withPassword("billisan_test_password")
		.withCommand(
			"--character-set-server=utf8mb4",
			"--collation-server=utf8mb4_0900_ai_ci",
			"--default-time-zone=+09:00"
		);

	@DynamicPropertySource
	static void mysqlProperties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
		registry.add("spring.datasource.username", MYSQL::getUsername);
		registry.add("spring.datasource.password", MYSQL::getPassword);
	}

	@Autowired
	private Flyway flyway;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Test
	void contextLoadsAndMigrationRerunIsSafe() {
		assertEquals(0, flyway.migrate().migrationsExecuted);
	}

	@Test
	void createsExactlyNineBusinessTables() {
		List<String> expectedTables = List.of(
			"damage_inspection",
			"device_operation",
			"payment_attempt",
			"rental",
			"return_attempt",
			"settlement",
			"slot",
			"station",
			"user_account"
		);

		List<String> actualTables = jdbcTemplate.queryForList("""
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = DATABASE()
			  AND table_name <> 'flyway_schema_history'
			ORDER BY table_name
			""", String.class);

		assertEquals(expectedTables, actualTables);
	}

	@Test
	void createsRequiredIndexesAndForeignKeys() {
		assertUniqueIndex("return_attempt", "request_id", "uk_return_attempt_request_id");
		assertNonUniqueIndex(
			"return_attempt",
			"rental_id",
			"idx_return_attempt_rental_status"
		);
		assertNoUniqueIndex("return_attempt", "rental_id");
		assertUniqueIndex(
			"damage_inspection",
			"return_attempt_id",
			"uk_damage_inspection_return_attempt_id"
		);
		assertForeignKey(
			"damage_inspection",
			"return_attempt_id",
			"return_attempt",
			"fk_damage_inspection_return_attempt"
		);
		assertUniqueIndex(
			"device_operation",
			"command_id",
			"uk_device_operation_command_id"
		);
		assertUniqueIndex(
			"device_operation",
			"event_id",
			"uk_device_operation_event_id"
		);
		assertUniqueIndex(
			"payment_attempt",
			"toss_order_id",
			"uk_payment_attempt_toss_order_id"
		);
		assertUniqueIndex(
			"payment_attempt",
			"toss_payment_key",
			"uk_payment_attempt_toss_payment_key"
		);
	}

	@Test
	void allowsASecondReturnAttemptForTheSameRental() {
		jdbcTemplate.update("""
			INSERT INTO user_account (
				user_id, login_id, role, account_status, face_registered, created_at, updated_at
			) VALUES (
				'10000000-0000-0000-0000-000000000001',
				'migration-test-user',
				'USER',
				'ACTIVE',
				FALSE,
				NOW(6),
				NOW(6)
			)
			""");
		jdbcTemplate.update("""
			INSERT INTO station (
				station_id, station_code, name, service_status, device_status, updated_at
			) VALUES (
				'20000000-0000-0000-0000-000000000001',
				'MIGRATION-STATION',
				'Migration Test Station',
				'AVAILABLE',
				'ONLINE',
				NOW(6)
			)
			""");
		jdbcTemplate.update("""
			INSERT INTO slot (
				slot_id, station_id, slot_number, item_condition,
				service_status, occupancy_status, lock_status, updated_at
			) VALUES
				(
					'30000000-0000-0000-0000-000000000001',
					'20000000-0000-0000-0000-000000000001',
					1,
					NULL,
					'AVAILABLE',
					'EMPTY',
					'LOCKED',
					NOW(6)
				),
				(
					'30000000-0000-0000-0000-000000000002',
					'20000000-0000-0000-0000-000000000001',
					2,
					NULL,
					'AVAILABLE',
					'EMPTY',
					'LOCKED',
					NOW(6)
				)
			""");
		jdbcTemplate.update("""
			INSERT INTO rental (
				rental_id, user_id, checkout_slot_id, rental_request_id, status,
				requested_at, rented_at, due_at
			) VALUES (
				'40000000-0000-0000-0000-000000000001',
				'10000000-0000-0000-0000-000000000001',
				'30000000-0000-0000-0000-000000000001',
				'migration-rental-request-1',
				'ACTIVE',
				NOW(6),
				NOW(6),
				DATE_ADD(NOW(6), INTERVAL 1 DAY)
			)
			""");
		jdbcTemplate.update("""
			INSERT INTO return_attempt (
				return_attempt_id, rental_id, return_slot_id, request_id,
				status, failure_reason, created_at
			) VALUES (
				'50000000-0000-0000-0000-000000000001',
				'40000000-0000-0000-0000-000000000001',
				'30000000-0000-0000-0000-000000000002',
				'migration-return-request-1',
				'FAILED',
				'SENSOR_TIMEOUT',
				NOW(6)
			)
			""");
		jdbcTemplate.update("""
			INSERT INTO return_attempt (
				return_attempt_id, rental_id, return_slot_id, request_id,
				status, created_at
			) VALUES (
				'50000000-0000-0000-0000-000000000002',
				'40000000-0000-0000-0000-000000000001',
				'30000000-0000-0000-0000-000000000002',
				'migration-return-request-2',
				'PROCESSING',
				NOW(6)
			)
			""");

		Integer attemptCount = jdbcTemplate.queryForObject("""
			SELECT COUNT(*)
			FROM return_attempt
			WHERE rental_id = '40000000-0000-0000-0000-000000000001'
			""", Integer.class);
		assertEquals(2, attemptCount);

		assertThrows(DuplicateKeyException.class, () -> jdbcTemplate.update("""
			INSERT INTO return_attempt (
				return_attempt_id, rental_id, return_slot_id, request_id,
				status, created_at
			) VALUES (
				'50000000-0000-0000-0000-000000000003',
				'40000000-0000-0000-0000-000000000001',
				'30000000-0000-0000-0000-000000000002',
				'migration-return-request-2',
				'PROCESSING',
				NOW(6)
			)
			"""));
	}

	@Test
	void excludesForbiddenReturnAndBiometricColumns() {
		Integer forbiddenReturnStatusColumns = jdbcTemplate.queryForObject("""
			SELECT COUNT(*)
			FROM information_schema.columns
			WHERE table_schema = DATABASE()
			  AND LOWER(column_name) IN ('process_status', 'processstatus')
			""", Integer.class);
		assertEquals(0, forbiddenReturnStatusColumns);

		Integer forbiddenBiometricColumns = jdbcTemplate.queryForObject("""
			SELECT COUNT(*)
			FROM information_schema.columns
			WHERE table_schema = DATABASE()
			  AND (
				LOWER(column_name) REGEXP '(^|_)(image|embedding|vector)($|_)'
				OR LOWER(data_type) = 'vector'
			  )
			""", Integer.class);
		assertEquals(0, forbiddenBiometricColumns);

		Integer forbiddenLegacyColumns = jdbcTemplate.queryForObject("""
			SELECT COUNT(*)
			FROM information_schema.columns
			WHERE table_schema = DATABASE()
			  AND (
				(table_name = 'payment_attempt' AND column_name = 'rental_request_id')
				OR column_name = 'umbrella_id'
			  )
			""", Integer.class);
		assertEquals(0, forbiddenLegacyColumns);

		Integer forbiddenUmbrellaTables = jdbcTemplate.queryForObject("""
			SELECT COUNT(*)
			FROM information_schema.tables
			WHERE table_schema = DATABASE()
			  AND table_name = 'umbrella'
			""", Integer.class);
		assertEquals(0, forbiddenUmbrellaTables);
	}

	private void assertUniqueIndex(String table, String column, String index) {
		Integer count = jdbcTemplate.queryForObject("""
			SELECT COUNT(*)
			FROM information_schema.statistics
			WHERE table_schema = DATABASE()
			  AND table_name = ?
			  AND column_name = ?
			  AND index_name = ?
			  AND non_unique = 0
			""", Integer.class, table, column, index);
		assertEquals(1, count);
	}

	private void assertNonUniqueIndex(String table, String column, String index) {
		Integer count = jdbcTemplate.queryForObject("""
			SELECT COUNT(*)
			FROM information_schema.statistics
			WHERE table_schema = DATABASE()
			  AND table_name = ?
			  AND column_name = ?
			  AND index_name = ?
			  AND non_unique = 1
			  AND seq_in_index = 1
			""", Integer.class, table, column, index);
		assertEquals(1, count);
	}

	private void assertNoUniqueIndex(String table, String column) {
		List<Map<String, Object>> indexes = jdbcTemplate.queryForList("""
			SELECT index_name
			FROM information_schema.statistics
			WHERE table_schema = DATABASE()
			  AND table_name = ?
			  AND column_name = ?
			  AND non_unique = 0
			""", table, column);
		assertTrue(indexes.isEmpty());
	}

	private void assertForeignKey(
		String table,
		String column,
		String referencedTable,
		String constraint
	) {
		Integer count = jdbcTemplate.queryForObject("""
			SELECT COUNT(*)
			FROM information_schema.key_column_usage
			WHERE table_schema = DATABASE()
			  AND table_name = ?
			  AND column_name = ?
			  AND referenced_table_name = ?
			  AND constraint_name = ?
			""", Integer.class, table, column, referencedTable, constraint);
		assertEquals(1, count);
	}

}
