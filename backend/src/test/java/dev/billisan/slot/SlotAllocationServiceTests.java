package dev.billisan.slot;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import dev.billisan.slot.SlotAllocationService.RentalAllocationCommand;
import dev.billisan.slot.SlotAllocationService.RentalAllocationResult;
import dev.billisan.slot.SlotAllocationService.ReturnAllocationCommand;
import dev.billisan.slot.SlotAllocationService.ReturnAllocationResult;
import dev.billisan.slot.SlotAllocationService.WorkType;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Testcontainers
@SpringBootTest
class SlotAllocationServiceTests {

	private static final String USER_ID = "100000009";
	private static final String USER_REF = "10000000-0000-0000-0000-000000000009";
	private static final String STATION_ID = "20000000-0000-0000-0000-000000000009";
	private static final String CHECKOUT_SLOT_ID =
		"30000000-0000-0000-0000-000000000009";
	private static final String RENTAL_ID = "40000000-0000-0000-0000-000000000009";

	@Container
	private static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.0")
		.withDatabaseName("billisan_slot_concurrency_test")
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
	private SlotAllocationService service;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@BeforeEach
	void resetBusinessData() {
		truncateBusinessData();

		LocalDateTime baseline = LocalDateTime.of(2026, 7, 26, 9, 0);
		insertUser(USER_ID, USER_REF, "step09-user@example.com", baseline);
		jdbcTemplate.update("""
			INSERT INTO station (
				station_id, name, service_status, device_status,
				created_at, updated_at
			) VALUES (?, 'STEP-09 Test Station', 'AVAILABLE', 'ONLINE', ?, ?)
			""",
			STATION_ID,
			baseline,
			baseline
		);
		jdbcTemplate.update("""
			INSERT INTO slot (
				slot_id, station_id, slot_number, item_condition,
				service_status, occupancy_status, lock_status, created_at, updated_at
			) VALUES (?, ?, 99, 'EMPTY', 'OUT_OF_SERVICE', 'EMPTY', 'LOCKED', ?, ?)
			""",
			CHECKOUT_SLOT_ID,
			STATION_ID,
			baseline,
			baseline
		);
		jdbcTemplate.update("""
			INSERT INTO rental (
				rental_id, user_id, checkout_slot_id, rental_request_id, status,
				requested_at, rented_at, due_at
			) VALUES (?, ?, ?, 'step09-existing-rental', 'RETURNING', ?, ?, ?)
			""",
			RENTAL_ID,
			USER_ID,
			CHECKOUT_SLOT_ID,
			baseline,
			baseline,
			baseline.plusDays(1)
		);
	}

	@Test
	void oneReturnSlotAndTwoRequestsAllowsExactlyOneOwner() throws Exception {
		String slotId = insertReturnCandidate(1);
		List<Callable<Object>> operations = List.of(
			() -> capture(() -> service.allocateReturnSlot(
				new ReturnAllocationCommand("return-race-1", RENTAL_ID, STATION_ID)
			)),
			() -> capture(() -> service.allocateReturnSlot(
				new ReturnAllocationCommand("return-race-2", RENTAL_ID, STATION_ID)
			))
		);

		List<Object> outcomes = runAtOnce(operations);

		assertEquals(1, outcomes.stream()
			.filter(ReturnAllocationResult.class::isInstance)
			.count());
		assertEquals(1, outcomes.stream()
			.filter(SlotUnavailableException.class::isInstance)
			.count());
		SlotUnavailableException rejection = outcomes.stream()
			.filter(SlotUnavailableException.class::isInstance)
			.map(SlotUnavailableException.class::cast)
			.findFirst()
			.orElseThrow();
		assertEquals(STATION_ID, rejection.getStationId());
		assertSame(WorkType.RETURN, rejection.getWorkType());
		assertEquals(1, count("""
			SELECT COUNT(*) FROM return_attempt WHERE status = 'PROCESSING'
			"""));
		assertEquals("AVAILABLE", text("""
			SELECT service_status FROM slot WHERE slot_id = ?
			""", slotId));
		assertNoDuplicateActiveSlotOwners();
	}

	@Test
	void nRentalSlotsAndNRequestsAllAcquireDifferentSlots() throws Exception {
		int slotCount = 4;
		for (int number = 1; number <= slotCount; number++) {
			insertRentalCandidate(number);
		}

		List<Object> outcomes = runRentalAllocations(slotCount);

		assertTrue(outcomes.stream().allMatch(RentalAllocationResult.class::isInstance));
		Set<String> acquiredSlots = new HashSet<>();
		for (Object outcome : outcomes) {
			acquiredSlots.add(((RentalAllocationResult) outcome).slotId());
		}
		assertEquals(slotCount, acquiredSlots.size());
		assertEquals(slotCount, count("""
			SELECT COUNT(*) FROM rental WHERE status = 'REQUESTED'
			"""));
		assertEquals(slotCount, count("""
			SELECT COUNT(DISTINCT checkout_slot_id)
			FROM rental
			WHERE status = 'REQUESTED'
			"""));
		assertNoDuplicateActiveSlotOwners();
	}

	@Test
	void nRentalSlotsAndNPlusOneRequestsRejectExactlyOne() throws Exception {
		int slotCount = 3;
		for (int number = 1; number <= slotCount; number++) {
			insertRentalCandidate(number);
		}

		List<Object> outcomes = runRentalAllocations(slotCount + 1);

		assertEquals(slotCount, outcomes.stream()
			.filter(RentalAllocationResult.class::isInstance)
			.count());
		assertEquals(1, outcomes.stream()
			.filter(SlotUnavailableException.class::isInstance)
			.count());
		assertEquals(slotCount, count("""
			SELECT COUNT(*) FROM rental WHERE status = 'REQUESTED'
			"""));
		assertNoDuplicateActiveSlotOwners();
	}

	@Test
	void exceptionDuringTransactionRollsBackSlotReservation() {
		String slotId = insertRentalCandidate(1);
		RentalAllocationCommand invalidOwner = new RentalAllocationCommand(
			"rental-rollback-invalid-owner",
			"999999999",
			STATION_ID
		);

		assertThrows(
			DataIntegrityViolationException.class,
			() -> service.allocateRentalSlot(invalidOwner)
		);

		assertEquals("AVAILABLE", text("""
			SELECT service_status FROM slot WHERE slot_id = ?
			""", slotId));
		assertEquals(0, count("""
			SELECT COUNT(*) FROM rental
			WHERE rental_request_id = 'rental-rollback-invalid-owner'
			"""));

		String retryUserId = testUserId(999);
		insertUser(
			retryUserId,
			testUserRef(999),
			"step09-retry@example.com",
			LocalDateTime.of(2026, 7, 26, 9, 0)
		);
		RentalAllocationResult retried = service.allocateRentalSlot(
			new RentalAllocationCommand(
				"rental-after-rollback",
				retryUserId,
				STATION_ID
			)
		);
		assertEquals(slotId, retried.slotId());
		assertNoDuplicateActiveSlotOwners();
	}

	@Test
	void failedReturnAllowsNewAttemptForTheSameRental() {
		insertReturnCandidate(1);
		ReturnAllocationResult failed = service.allocateReturnSlot(
			new ReturnAllocationCommand("return-retry-failed", RENTAL_ID, STATION_ID)
		);
		jdbcTemplate.update("""
			UPDATE return_attempt
			SET status = 'FAILED',
			    failure_reason = 'SENSOR_TIMEOUT'
			WHERE return_attempt_id = ?
			""",
			failed.returnAttemptId()
		);
		ReturnAllocationResult retried = service.allocateReturnSlot(
			new ReturnAllocationCommand("return-retry-new", RENTAL_ID, STATION_ID)
		);

		assertNotEquals(failed.returnAttemptId(), retried.returnAttemptId());
		assertEquals(2, count("""
			SELECT COUNT(*) FROM return_attempt WHERE rental_id = ?
			""", RENTAL_ID));
		assertEquals(1, count("""
			SELECT COUNT(*) FROM return_attempt
			WHERE rental_id = ?
			  AND status = 'FAILED'
			""", RENTAL_ID));
		assertEquals(1, count("""
			SELECT COUNT(*) FROM return_attempt
			WHERE rental_id = ?
			  AND status = 'PROCESSING'
			""", RENTAL_ID));
		assertNoDuplicateActiveSlotOwners();
	}

	@Test
	void databaseGuardsPreventDuplicateActiveOwners() {
		List<String> columns = jdbcTemplate.queryForList("""
			SELECT column_name
			FROM information_schema.statistics
			WHERE table_schema = DATABASE()
			  AND table_name = 'rental'
			  AND index_name = 'UK_RENTAL_REQUESTED_SLOT_GUARD'
			ORDER BY seq_in_index
			""",
			String.class
		);
		assertEquals(List.of("requested_slot_guard"), columns);
		assertEquals(List.of("active_user_guard"), indexColumns(
			"rental",
			"UK_RENTAL_ACTIVE_USER_GUARD"
		));
		assertEquals(List.of("assigned_return_slot_guard"), indexColumns(
			"return_attempt",
			"UK_RETURN_ATTEMPT_ASSIGNED_SLOT_GUARD"
		));
	}

	private List<Object> runRentalAllocations(int requestCount) throws Exception {
		List<Callable<Object>> operations = new ArrayList<>();
		for (int number = 1; number <= requestCount; number++) {
			int requestNumber = number;
			String userId = testUserId(requestNumber);
			insertUser(
				userId,
				testUserRef(requestNumber),
				"step09-concurrent-" + requestNumber + "@example.com",
				LocalDateTime.of(2026, 7, 26, 9, 0)
			);
			operations.add(() -> capture(() -> service.allocateRentalSlot(
				new RentalAllocationCommand(
					"rental-concurrent-" + requestNumber,
					userId,
					STATION_ID
				)
			)));
		}
		return runAtOnce(operations);
	}

	private String insertRentalCandidate(int slotNumber) {
		String slotId = "31000000-0000-0000-0000-%012d".formatted(slotNumber);
		insertSlot(slotId, slotNumber, "NORMAL", "OCCUPIED");
		return slotId;
	}

	private String insertReturnCandidate(int slotNumber) {
		String slotId = "32000000-0000-0000-0000-%012d".formatted(slotNumber);
		insertSlot(slotId, slotNumber, "EMPTY", "EMPTY");
		return slotId;
	}

	private void insertSlot(
		String slotId,
		int slotNumber,
		String itemCondition,
		String occupancyStatus
	) {
		jdbcTemplate.update("""
			INSERT INTO slot (
				slot_id, station_id, slot_number, item_condition,
				service_status, occupancy_status, lock_status, created_at, updated_at
			) VALUES (?, ?, ?, ?, 'AVAILABLE', ?, 'LOCKED', ?, ?)
			""",
			slotId,
			STATION_ID,
			slotNumber,
			itemCondition,
			occupancyStatus,
			LocalDateTime.of(2026, 7, 26, 9, 0),
			LocalDateTime.of(2026, 7, 26, 9, 0)
		);
	}

	private void insertUser(
		String userId,
		String userRef,
		String loginId,
		LocalDateTime baseline
	) {
		jdbcTemplate.update("""
			INSERT INTO user_account (
				user_id, user_ref, login_id, password_hash, name,
				face_registered, created_at, updated_at
			) VALUES (?, ?, ?, '{noop}step09-password', 'STEP-09 User', FALSE, ?, ?)
			""",
			userId,
			userRef,
			loginId,
			baseline,
			baseline
		);
	}

	private String testUserId(int number) {
		return "200%06d".formatted(number);
	}

	private String testUserRef(int number) {
		return "11000000-0000-0000-0000-%012d".formatted(number);
	}

	private List<String> indexColumns(String tableName, String indexName) {
		return jdbcTemplate.queryForList("""
			SELECT column_name
			FROM information_schema.statistics
			WHERE table_schema = DATABASE()
			  AND table_name = ?
			  AND index_name = ?
			ORDER BY seq_in_index
			""",
			String.class,
			tableName,
			indexName
		);
	}

	private void truncateBusinessData() {
		jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 0");
		try {
			for (String table : List.of(
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

	private void assertNoDuplicateActiveSlotOwners() {
		assertEquals(0, count("""
			SELECT COUNT(*)
			FROM (
				SELECT active.slot_id
				FROM (
					SELECT checkout_slot_id AS slot_id
					FROM rental
					WHERE status = 'REQUESTED'
					UNION ALL
					SELECT return_slot_id AS slot_id
					FROM return_attempt
					WHERE status IN (
						'PROCESSING',
						'PHYSICAL_DONE',
						'RECOVERY_REQUIRED'
					)
				) active
				GROUP BY active.slot_id
				HAVING COUNT(*) > 1
			) duplicate_owner
			"""));
	}

	private <T> List<T> runAtOnce(List<Callable<T>> operations) throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(operations.size());
		CountDownLatch ready = new CountDownLatch(operations.size());
		CountDownLatch start = new CountDownLatch(1);
		List<Future<T>> futures = new ArrayList<>();

		try {
			for (Callable<T> operation : operations) {
				futures.add(executor.submit(() -> {
					ready.countDown();
					if (!start.await(5, TimeUnit.SECONDS)) {
						throw new IllegalStateException("Concurrent test start timed out");
					}
					return operation.call();
				}));
			}
			assertTrue(ready.await(5, TimeUnit.SECONDS));
			start.countDown();

			List<T> results = new ArrayList<>();
			for (Future<T> future : futures) {
				results.add(future.get(20, TimeUnit.SECONDS));
			}
			return results;
		} finally {
			executor.shutdownNow();
		}
	}

	private Object capture(Supplier<?> operation) {
		try {
			return operation.get();
		} catch (RuntimeException exception) {
			return exception;
		}
	}

	private int count(String sql, Object... arguments) {
		Integer value = jdbcTemplate.queryForObject(sql, Integer.class, arguments);
		if (value == null) {
			throw new IllegalStateException("COUNT query returned null");
		}
		return value;
	}

	private String text(String sql, Object... arguments) {
		return jdbcTemplate.queryForObject(sql, String.class, arguments);
	}
}
