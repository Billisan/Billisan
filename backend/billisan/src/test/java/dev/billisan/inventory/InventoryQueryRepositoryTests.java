package dev.billisan.inventory;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import javax.sql.DataSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import dev.billisan.inventory.InventoryQueryRepository.AdminActivitySummary;
import dev.billisan.inventory.InventoryQueryRepository.DeviceOperationView;
import dev.billisan.inventory.InventoryQueryRepository.ReturnAttemptView;
import dev.billisan.inventory.InventoryQueryRepository.SlotView;
import dev.billisan.inventory.InventoryQueryRepository.StationInventorySummary;

import static dev.billisan.inventory.Backend2QueryScenarioFixture.DATABASE_NAME;
import static dev.billisan.inventory.Backend2QueryScenarioFixture.SLOT_ADMIN_REVIEW_ID;
import static dev.billisan.inventory.Backend2QueryScenarioFixture.STATION_ID;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Testcontainers
@SpringBootTest
class InventoryQueryRepositoryTests {

	@Container
	private static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.0")
		.withDatabaseName(DATABASE_NAME)
		.withUsername("billisan")
		.withPassword("billisan_test_password")
		.withCommand(
			"--character-set-server=utf8mb4",
			"--collation-server=utf8mb4_0900_ai_ci",
			"--default-time-zone=+00:00",
			"--log-bin-trust-function-creators=1"
		);

	@DynamicPropertySource
	static void mysqlProperties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
		registry.add("spring.datasource.username", MYSQL::getUsername);
		registry.add("spring.datasource.password", MYSQL::getPassword);
	}

	@Autowired
	private InventoryQueryRepository repository;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private DataSource dataSource;

	private Backend2QueryScenarioFixture fixture;

	@BeforeEach
	void resetScenario() {
		fixture = new Backend2QueryScenarioFixture(jdbcTemplate, dataSource);
		fixture.resetAndLoad();
	}

	@Test
	void fixtureContainsOnlyTheRequestedSyntheticScenario() {
		assertEquals(4, count("SELECT COUNT(*) FROM user_account"));
		assertEquals(1, count("SELECT COUNT(*) FROM station"));
		assertEquals(5, count("SELECT COUNT(*) FROM slot"));
		assertEquals(4, count("SELECT COUNT(*) FROM rental"));
		assertEquals(3, count("SELECT COUNT(*) FROM return_attempt"));
		assertEquals(3, count("SELECT COUNT(*) FROM device_operation"));
		assertEquals(0, count("""
			SELECT COUNT(*) FROM user_account WHERE face_registered = TRUE
			"""));
		assertEquals(0, count("""
			SELECT COUNT(*)
			FROM information_schema.columns
			WHERE table_schema = DATABASE()
			  AND (
				column_name REGEXP '(^|_)(image|embedding)(_|$)'
				OR data_type = 'vector'
			  )
			"""));
	}

	@Test
	void fixtureCanBeLoadedTwiceWithoutAccumulatingRows() {
		fixture.resetAndLoad();

		assertEquals(4, count("SELECT COUNT(*) FROM user_account"));
		assertEquals(1, count("SELECT COUNT(*) FROM station"));
		assertEquals(5, count("SELECT COUNT(*) FROM slot"));
		assertEquals(4, count("SELECT COUNT(*) FROM rental"));
		assertEquals(3, count("SELECT COUNT(*) FROM return_attempt"));
		assertEquals(3, count("SELECT COUNT(*) FROM device_operation"));
	}

	@Test
	void fixtureRefusesAnyDatabaseOtherThanItsDedicatedTestDatabase() {
		IllegalStateException exception = assertThrows(
			IllegalStateException.class,
			() -> fixture.assertDedicatedTestDatabase(
				"not_the_fixture_database"
			)
		);

		assertTrue(exception.getMessage().contains("non-test database"));
		assertEquals(5, count("SELECT COUNT(*) FROM slot"));
	}

	@Test
	void stationInventorySummaryUsesTheConfirmedAllocationStateRules() {
		StationInventorySummary summary = repository
			.findStationInventorySummary(STATION_ID)
			.orElseThrow();

		assertEquals(5, summary.totalSlotCount());
		assertEquals(1, summary.rentableSlotCount());
		assertEquals(1, summary.rentingSlotCount());
		assertEquals(1, summary.returningSlotCount());
		assertEquals(1, summary.adminReviewSlotCount());
		assertTrue(
			repository.findStationInventorySummary(
				"22000000-0000-0000-0000-000000000099"
			).isEmpty()
		);
	}

	@Test
	void slotListReflectsDatabaseStateInPhysicalOrder() {
		List<SlotView> slots = repository.findSlotsByStation(STATION_ID);

		assertEquals(5, slots.size());
		assertEquals(List.of(1, 2, 3, 4, 5), slots.stream()
			.map(SlotView::slotNumber)
			.toList());
		assertEquals(
			List.of(
				"AVAILABLE",
				"AVAILABLE",
				"AVAILABLE",
				"ADMIN_REVIEW",
				"AVAILABLE"
			),
			slots.stream().map(SlotView::serviceStatus).toList()
		);
		SlotView adminReview = slots.stream()
			.filter(slot -> slot.slotId().equals(SLOT_ADMIN_REVIEW_ID))
			.findFirst()
			.orElseThrow();
		assertEquals("UNKNOWN", adminReview.itemCondition());
		assertEquals("ERROR", adminReview.lockStatus());
	}

	@Test
	void adminSummaryAggregatesRentalsReturnsCommandsAndEventsInDatabase() {
		AdminActivitySummary summary = repository
			.findAdminActivitySummary(STATION_ID)
			.orElseThrow();

		assertEquals(1, summary.activeRentalCount());
		assertEquals(1, summary.failedReturnAttemptCount());
		assertEquals(1, summary.completedReturnAttemptCount());
		assertEquals(3, summary.deviceCommandCount());
		assertEquals(2, summary.deviceEventCount());
		assertTrue(
			repository.findAdminActivitySummary(
				"22000000-0000-0000-0000-000000000099"
			).isEmpty()
		);
	}

	@Test
	void resolvedReturnAttemptQueryReturnsFailureAndCompletionOnly() {
		assertEquals("+00:00", text("SELECT @@session.time_zone"));
		List<ReturnAttemptView> attempts =
			repository.findResolvedReturnAttempts(STATION_ID);

		assertEquals(2, attempts.size());
		assertEquals(
			List.of("FAILED", "COMPLETED"),
			attempts.stream().map(ReturnAttemptView::status).toList()
		);
		assertEquals(
			"FIXTURE_SENSOR_TIMEOUT",
			attempts.getFirst().failureReason()
		);
		assertNull(attempts.getFirst().completedAt());
		assertEquals(
			LocalDateTime.of(2026, 7, 27, 8, 46),
			attempts.get(1).completedAt()
		);
	}

	@Test
	void deviceOperationQueryKeepsCommandAndEventCountsSeparate() {
		List<DeviceOperationView> operations =
			repository.findDeviceOperations(STATION_ID);

		assertEquals(3, operations.size());
		assertEquals(2, operations.stream()
			.filter(operation -> operation.eventId() != null)
			.count());
		assertEquals(
			List.of("REQUESTED", "SUCCEEDED", "FAILED"),
			operations.stream().map(DeviceOperationView::status).toList()
		);
		assertNull(operations.getFirst().eventId());
	}

	@Test
	void stationScopedQueriesHaveSupportingIndexes() {
		assertIndexPrefix(
			"slot",
			List.of("station_id", "slot_number")
		);
		assertIndexPrefix(
			"rental",
			List.of("checkout_slot_id")
		);
		assertIndexPrefix(
			"return_attempt",
			List.of("return_slot_id")
		);
		assertTrue(hasIndexStartingWith("device_operation", "station_id"));
	}

	private void assertIndexPrefix(String table, List<String> expectedColumns) {
		List<Map<String, Object>> indexes = jdbcTemplate.queryForList("""
			SELECT index_name, seq_in_index, column_name
			FROM information_schema.statistics
			WHERE table_schema = DATABASE()
			  AND table_name = ?
			ORDER BY index_name, seq_in_index
			""",
			table
		);
		Map<String, List<String>> columnsByIndex = indexes.stream()
			.collect(java.util.stream.Collectors.groupingBy(
				row -> (String) row.get("index_name"),
				java.util.stream.Collectors.mapping(
					row -> (String) row.get("column_name"),
					java.util.stream.Collectors.toList()
				)
			));
		assertTrue(columnsByIndex.values().stream()
			.anyMatch(columns -> columns.size() >= expectedColumns.size()
				&& columns.subList(0, expectedColumns.size())
					.equals(expectedColumns)));
	}

	private boolean hasIndexStartingWith(String table, String firstColumn) {
		Integer count = jdbcTemplate.queryForObject("""
			SELECT COUNT(*)
			FROM information_schema.statistics
			WHERE table_schema = DATABASE()
			  AND table_name = ?
			  AND seq_in_index = 1
			  AND column_name = ?
			""",
			Integer.class,
			table,
			firstColumn
		);
		return count != null && count > 0;
	}

	private int count(String sql) {
		Integer value = jdbcTemplate.queryForObject(sql, Integer.class);
		if (value == null) {
			throw new IllegalStateException("COUNT query returned null");
		}
		return value;
	}

	private String text(String sql) {
		return jdbcTemplate.queryForObject(sql, String.class);
	}

}
