package dev.billisan.idempotency;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

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

import dev.billisan.idempotency.IdempotencyService.DeviceCommand;
import dev.billisan.idempotency.IdempotencyService.DeviceCommandResult;
import dev.billisan.idempotency.IdempotencyService.DeviceEvent;
import dev.billisan.idempotency.IdempotencyService.DeviceEventResult;
import dev.billisan.idempotency.IdempotencyService.Outcome;
import dev.billisan.idempotency.IdempotencyService.PaymentApproval;
import dev.billisan.idempotency.IdempotencyService.PaymentApprovalResult;
import dev.billisan.idempotency.IdempotencyService.ReturnAttemptCommand;
import dev.billisan.idempotency.IdempotencyService.ReturnAttemptResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Testcontainers
@SpringBootTest
class IdempotencyServiceTests {

	private static final String USER_ID = "10000000-0000-0000-0000-000000000008";
	private static final String STATION_ID = "20000000-0000-0000-0000-000000000008";
	private static final String SLOT_1 = "30000000-0000-0000-0000-000000000081";
	private static final String SLOT_2 = "30000000-0000-0000-0000-000000000082";
	private static final String SLOT_3 = "30000000-0000-0000-0000-000000000083";
	private static final String SLOT_4 = "30000000-0000-0000-0000-000000000084";
	private static final String RENTAL_1 = "40000000-0000-0000-0000-000000000081";
	private static final String RENTAL_2 = "40000000-0000-0000-0000-000000000082";
	private static final String SETTLEMENT_1 = "70000000-0000-0000-0000-000000000081";
	private static final String SETTLEMENT_2 = "70000000-0000-0000-0000-000000000082";
	private static final String PAYMENT_1 = "80000000-0000-0000-0000-000000000081";
	private static final String PAYMENT_2 = "80000000-0000-0000-0000-000000000082";
	private static final String ORDER_1 = "ORDER-STEP08-1";
	private static final String ORDER_2 = "ORDER-STEP08-2";
	private static final String BOOT_ID = "90000000-0000-0000-0000-000000000008";
	private static final LocalDateTime EVENT_TIME =
		LocalDateTime.of(2026, 7, 26, 14, 30, 0, 123_456_000);

	@Container
	private static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.0")
		.withDatabaseName("billisan_idempotency_test")
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
	private IdempotencyService service;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@BeforeEach
	void resetBusinessData() {
		jdbcTemplate.update("DELETE FROM payment_attempt");
		jdbcTemplate.update("DELETE FROM settlement");
		jdbcTemplate.update("DELETE FROM device_operation");
		jdbcTemplate.update("DELETE FROM damage_inspection");
		jdbcTemplate.update("DELETE FROM return_attempt");
		jdbcTemplate.update("DELETE FROM rental");
		jdbcTemplate.update("DELETE FROM slot");
		jdbcTemplate.update("DELETE FROM station");
		jdbcTemplate.update("DELETE FROM face_profile_sync_operation");
		jdbcTemplate.update("DELETE FROM user_account");

		LocalDateTime baseline = LocalDateTime.of(2026, 7, 26, 9, 0);
		jdbcTemplate.update("""
			INSERT INTO user_account (
				user_id, login_id, password_hash, name, role,
				face_registered, created_at, updated_at
			) VALUES (
				?, 'step08-user', '{noop}step08-password', 'STEP-08 User',
				'USER', FALSE, ?, ?
			)
			""",
			USER_ID,
			baseline,
			baseline
		);
		jdbcTemplate.update("""
			INSERT INTO station (
				station_id, station_code, name, service_status, device_status,
				current_boot_id, boot_synced_at, updated_at
			) VALUES (
				?, 'STEP08-STATION', 'STEP-08 Test Station',
				'AVAILABLE', 'ONLINE', ?, ?, ?
			)
			""",
			STATION_ID,
			BOOT_ID,
			baseline,
			baseline
		);
		jdbcTemplate.batchUpdate("""
			INSERT INTO slot (
				slot_id, station_id, slot_number, item_condition,
				service_status, occupancy_status, lock_status, updated_at
			) VALUES (?, ?, ?, 'EMPTY', 'AVAILABLE', 'EMPTY', 'LOCKED', ?)
			""",
			List.of(
				new Object[] { SLOT_1, STATION_ID, 1, baseline },
				new Object[] { SLOT_2, STATION_ID, 2, baseline },
				new Object[] { SLOT_3, STATION_ID, 3, baseline },
				new Object[] { SLOT_4, STATION_ID, 4, baseline }
			)
		);
		jdbcTemplate.update("""
			INSERT INTO rental (
				rental_id, user_id, checkout_slot_id, rental_request_id, status,
				requested_at, rented_at, due_at
			) VALUES (?, ?, ?, 'step08-rental-request-1', 'ACTIVE', ?, ?, ?)
			""",
			RENTAL_1,
			USER_ID,
			SLOT_1,
			baseline,
			baseline,
			baseline.plusDays(1)
		);
		jdbcTemplate.update("""
			INSERT INTO rental (
				rental_id, user_id, checkout_slot_id, rental_request_id, status,
				requested_at, rented_at, due_at, ended_at
			) VALUES (?, ?, ?, 'step08-rental-request-2', 'COMPLETED', ?, ?, ?, ?)
			""",
			RENTAL_2,
			USER_ID,
			SLOT_4,
			baseline,
			baseline,
			baseline.plusDays(1),
			baseline.plusHours(1)
		);
		jdbcTemplate.update("""
			INSERT INTO settlement (
				settlement_id, user_id, rental_id, reason, amount, status, created_at
			) VALUES (?, ?, ?, 'OVERDUE', 1000, 'PENDING', ?)
			""",
			SETTLEMENT_1,
			USER_ID,
			RENTAL_1,
			baseline
		);
		jdbcTemplate.update("""
			INSERT INTO settlement (
				settlement_id, user_id, rental_id, reason, amount, status, created_at
			) VALUES (?, ?, ?, 'DAMAGE', 2000, 'PENDING', ?)
			""",
			SETTLEMENT_2,
			USER_ID,
			RENTAL_2,
			baseline
		);
		jdbcTemplate.update("""
			INSERT INTO payment_attempt (
				payment_attempt_id, settlement_id, creation_request_id,
				toss_order_id, amount, provider, status, requested_at, updated_at
			) VALUES (?, ?, 'payment-create-step08-1', ?, 1000, 'MOCK', 'REQUESTED', ?, ?)
			""",
			PAYMENT_1,
			SETTLEMENT_1,
			ORDER_1,
			baseline,
			baseline
		);
		jdbcTemplate.update("""
			INSERT INTO payment_attempt (
				payment_attempt_id, settlement_id, creation_request_id,
				toss_order_id, amount, provider, status, requested_at, updated_at
			) VALUES (?, ?, 'payment-create-step08-2', ?, 2000, 'MOCK', 'REQUESTED', ?, ?)
			""",
			PAYMENT_2,
			SETTLEMENT_2,
			ORDER_2,
			baseline,
			baseline
		);
	}

	@Test
	void sameRequestIdSequentiallyReturnsStoredAttemptOnce() {
		ReturnAttemptCommand command =
			new ReturnAttemptCommand("return-request-sequential", RENTAL_1, SLOT_2);

		ReturnAttemptResult first = service.createReturnAttempt(command);
		LocalDateTime firstSlotUpdate = dateTime("""
			SELECT updated_at FROM slot WHERE slot_id = ?
			""", SLOT_2);
		ReturnAttemptResult second = service.createReturnAttempt(command);

		assertEquals(Outcome.APPLIED, first.outcome());
		assertEquals(Outcome.REPLAYED, second.outcome());
		assertEquals(first.returnAttemptId(), second.returnAttemptId());
		assertEquals(1, count("""
			SELECT COUNT(*) FROM return_attempt WHERE request_id = ?
			""", command.requestId()));
		assertEquals("AVAILABLE", text("""
			SELECT service_status FROM slot WHERE slot_id = ?
			""", SLOT_2));
		assertEquals(firstSlotUpdate, dateTime("""
			SELECT updated_at FROM slot WHERE slot_id = ?
			""", SLOT_2));
	}

	@Test
	void sameRequestIdConcurrentlyCreatesOneAttemptAndOneSlotTransition() throws Exception {
		ReturnAttemptCommand command =
			new ReturnAttemptCommand("return-request-concurrent", RENTAL_1, SLOT_2);

		List<ReturnAttemptResult> results =
			runConcurrently(() -> service.createReturnAttempt(command));

		assertEquals(
			Set.of(Outcome.APPLIED, Outcome.REPLAYED),
			Set.of(results.get(0).outcome(), results.get(1).outcome())
		);
		assertEquals(
			results.get(0).returnAttemptId(),
			results.get(1).returnAttemptId()
		);
		assertEquals(1, count("""
			SELECT COUNT(*) FROM return_attempt WHERE request_id = ?
			""", command.requestId()));
		assertEquals("AVAILABLE", text("""
			SELECT service_status FROM slot WHERE slot_id = ?
			""", SLOT_2));
	}

	@Test
	void sameCommandIdReturnsStoredCommandWithoutSecondIssue() {
		DeviceCommand command =
			new DeviceCommand(
				"command-retry-1", STATION_ID, SLOT_2, RENTAL_1,
				null, BOOT_ID, "LOCK"
			);

		DeviceCommandResult first = service.registerDeviceCommand(command);
		DeviceCommandResult second = service.registerDeviceCommand(command);

		assertEquals(Outcome.APPLIED, first.outcome());
		assertEquals(Outcome.REPLAYED, second.outcome());
		assertEquals(first.operationId(), second.operationId());
		assertEquals(1, count("""
			SELECT COUNT(*) FROM device_operation WHERE command_id = ?
			""", command.commandId()));
	}

	@Test
	void sameCommandIdConcurrentlyCreatesOneOperation() throws Exception {
		DeviceCommand command =
			new DeviceCommand(
				"command-concurrent-1", STATION_ID, SLOT_2, RENTAL_1,
				null, BOOT_ID, "LOCK"
			);

		List<DeviceCommandResult> results =
			runConcurrently(() -> service.registerDeviceCommand(command));

		assertEquals(
			Set.of(Outcome.APPLIED, Outcome.REPLAYED),
			Set.of(results.get(0).outcome(), results.get(1).outcome())
		);
		assertEquals(results.get(0).operationId(), results.get(1).operationId());
		assertEquals(1, count("""
			SELECT COUNT(*) FROM device_operation WHERE command_id = ?
			""", command.commandId()));
	}

	@Test
	void sameEventIdAppliesSlotStateOnce() {
		DeviceCommand command =
			new DeviceCommand(
				"command-event-1", STATION_ID, SLOT_2, RENTAL_1,
				null, BOOT_ID, "LOCK"
			);
		service.registerDeviceCommand(command);
		DeviceEvent event = successfulEvent("event-retry-1", command.commandId(), SLOT_2);

		DeviceEventResult first = service.applyDeviceEvent(event);
		LocalDateTime firstSlotUpdate = dateTime("""
			SELECT updated_at FROM slot WHERE slot_id = ?
			""", SLOT_2);
		DeviceEventResult second = service.applyDeviceEvent(event);

		assertEquals(Outcome.APPLIED, first.outcome());
		assertEquals(Outcome.REPLAYED, second.outcome());
		assertEquals(first.operationId(), second.operationId());
		assertEquals(firstSlotUpdate, dateTime("""
			SELECT updated_at FROM slot WHERE slot_id = ?
			""", SLOT_2));

		DeviceCommand laterCommand =
			new DeviceCommand(
				"command-event-2", STATION_ID, SLOT_2, RENTAL_1,
				null, BOOT_ID, "UNLOCK"
			);
		service.registerDeviceCommand(laterCommand);
		service.applyDeviceEvent(new DeviceEvent(
			"event-later-2",
			laterCommand.commandId(),
			BOOT_ID,
			SLOT_2,
			"EMPTY",
			"UNLOCKED",
			true,
			"OK",
			EVENT_TIME.plusSeconds(1)
		));
		LocalDateTime laterSlotUpdate = dateTime("""
			SELECT updated_at FROM slot WHERE slot_id = ?
			""", SLOT_2);

		DeviceEventResult replayAfterLaterEvent = service.applyDeviceEvent(event);

		assertEquals(Outcome.REPLAYED, replayAfterLaterEvent.outcome());
		assertEquals(1, count("""
			SELECT COUNT(*) FROM device_operation WHERE event_id = ?
			""", event.eventId()));
		assertEquals("EMPTY", text("""
			SELECT occupancy_status FROM slot WHERE slot_id = ?
			""", SLOT_2));
		assertEquals("UNLOCKED", text("""
			SELECT lock_status FROM slot WHERE slot_id = ?
			""", SLOT_2));
		assertEquals(laterSlotUpdate, dateTime("""
			SELECT updated_at FROM slot WHERE slot_id = ?
			""", SLOT_2));
	}

	@Test
	void sameEventIdConcurrentlyAppliesSlotStateOnce() throws Exception {
		DeviceCommand command =
			new DeviceCommand(
				"command-event-concurrent", STATION_ID, SLOT_2, RENTAL_1,
				null, BOOT_ID, "LOCK"
			);
		service.registerDeviceCommand(command);
		DeviceEvent event =
			successfulEvent("event-concurrent-1", command.commandId(), SLOT_2);

		List<DeviceEventResult> results =
			runConcurrently(() -> service.applyDeviceEvent(event));

		assertEquals(
			Set.of(Outcome.APPLIED, Outcome.REPLAYED),
			Set.of(results.get(0).outcome(), results.get(1).outcome())
		);
		assertEquals(results.get(0).operationId(), results.get(1).operationId());
		assertEquals(1, count("""
			SELECT COUNT(*) FROM device_operation WHERE event_id = ?
			""", event.eventId()));
		assertEquals(EVENT_TIME, dateTime("""
			SELECT updated_at FROM slot WHERE slot_id = ?
			""", SLOT_2));
	}

	@Test
	void samePaymentApprovalIdentifierPaysOnce() {
		PaymentApproval approval =
			new PaymentApproval(PAYMENT_1, ORDER_1, "payment-key-retry-1", 1000);

		PaymentApprovalResult first = service.approvePayment(approval);
		LocalDateTime firstPaymentUpdate = dateTime("""
			SELECT completed_at FROM payment_attempt WHERE payment_attempt_id = ?
			""", PAYMENT_1);
		PaymentApprovalResult second = service.approvePayment(approval);

		assertEquals(Outcome.APPLIED, first.outcome());
		assertEquals(Outcome.REPLAYED, second.outcome());
		assertEquals(first.approvedAt(), second.approvedAt());
		assertEquals(1, count("""
			SELECT COUNT(*) FROM payment_attempt WHERE toss_payment_key = ?
			""", approval.paymentKey()));
		assertEquals("SUCCEEDED", text("""
			SELECT status FROM payment_attempt WHERE payment_attempt_id = ?
			""", PAYMENT_1));
		assertEquals("PAID", text("""
			SELECT status FROM settlement WHERE settlement_id = ?
			""", SETTLEMENT_1));
		assertEquals(firstPaymentUpdate, dateTime("""
			SELECT completed_at FROM payment_attempt WHERE payment_attempt_id = ?
			""", PAYMENT_1));
	}

	@Test
	void samePaymentApprovalConcurrentlyPaysOnce() throws Exception {
		PaymentApproval approval =
			new PaymentApproval(PAYMENT_1, ORDER_1, "payment-key-concurrent-1", 1000);

		List<PaymentApprovalResult> results =
			runConcurrently(() -> service.approvePayment(approval));

		assertEquals(
			Set.of(Outcome.APPLIED, Outcome.REPLAYED),
			Set.of(results.get(0).outcome(), results.get(1).outcome())
		);
		assertEquals(results.get(0).approvedAt(), results.get(1).approvedAt());
		assertEquals(1, count("""
			SELECT COUNT(*) FROM payment_attempt WHERE toss_payment_key = ?
			""", approval.paymentKey()));
		assertEquals("SUCCEEDED", text("""
			SELECT status FROM payment_attempt WHERE payment_attempt_id = ?
			""", PAYMENT_1));
		assertEquals("PAID", text("""
			SELECT status FROM settlement WHERE settlement_id = ?
			""", SETTLEMENT_1));
	}

	@Test
	void differentIdentifiersAreProcessedNormally() {
		ReturnAttemptResult returnOne = service.createReturnAttempt(
			new ReturnAttemptCommand("different-request-1", RENTAL_1, SLOT_2)
		);
		ReturnAttemptResult returnTwo = service.createReturnAttempt(
			new ReturnAttemptCommand("different-request-2", RENTAL_1, SLOT_3)
		);
		assertNotEquals(returnOne.returnAttemptId(), returnTwo.returnAttemptId());

		DeviceCommand commandOne = new DeviceCommand(
			"different-command-1",
			STATION_ID,
			SLOT_2,
			RENTAL_1,
			returnOne.returnAttemptId(),
			BOOT_ID,
			"LOCK"
		);
		DeviceCommand commandTwo = new DeviceCommand(
			"different-command-2",
			STATION_ID,
			SLOT_3,
			RENTAL_1,
			returnTwo.returnAttemptId(),
			BOOT_ID,
			"LOCK"
		);
		service.registerDeviceCommand(commandOne);
		service.registerDeviceCommand(commandTwo);
		service.applyDeviceEvent(
			successfulEvent("different-event-1", commandOne.commandId(), SLOT_2)
		);
		service.applyDeviceEvent(
			successfulEvent("different-event-2", commandTwo.commandId(), SLOT_3)
		);
		service.approvePayment(
			new PaymentApproval(PAYMENT_1, ORDER_1, "different-payment-key-1", 1000)
		);
		service.approvePayment(
			new PaymentApproval(PAYMENT_2, ORDER_2, "different-payment-key-2", 2000)
		);

		assertEquals(2, count("""
			SELECT COUNT(*) FROM return_attempt
			WHERE request_id IN ('different-request-1', 'different-request-2')
			"""));
		assertEquals(2, count("""
			SELECT COUNT(*) FROM device_operation
			WHERE command_id IN ('different-command-1', 'different-command-2')
			  AND event_id IS NOT NULL
			"""));
		assertEquals(2, count("""
			SELECT COUNT(*) FROM payment_attempt WHERE status = 'SUCCEEDED'
			"""));
	}

	@Test
	void conflictingDuplicatesRollBackAllSecondaryEffects() {
		service.createReturnAttempt(
			new ReturnAttemptCommand("conflict-request-1", RENTAL_1, SLOT_2)
		);
		assertThrows(IdempotencyConflictException.class, () ->
			service.createReturnAttempt(
				new ReturnAttemptCommand("conflict-request-1", RENTAL_1, SLOT_3)
			)
		);
		assertEquals("AVAILABLE", text("""
			SELECT service_status FROM slot WHERE slot_id = ?
			""", SLOT_3));

		DeviceCommand commandOne =
			new DeviceCommand(
				"conflict-command-1", STATION_ID, SLOT_2, RENTAL_1,
				null, BOOT_ID, "LOCK"
			);
		service.registerDeviceCommand(commandOne);
		assertThrows(IdempotencyConflictException.class, () ->
			service.registerDeviceCommand(
				new DeviceCommand(
					"conflict-command-1",
					STATION_ID,
					SLOT_3,
					RENTAL_1,
					null,
					BOOT_ID,
					"LOCK"
				)
			)
		);
		assertEquals(1, count("""
			SELECT COUNT(*) FROM device_operation WHERE command_id = 'conflict-command-1'
			"""));

		service.applyDeviceEvent(
			successfulEvent("conflict-event-1", commandOne.commandId(), SLOT_2)
		);
		DeviceCommand commandTwo =
			new DeviceCommand(
				"conflict-command-2", STATION_ID, SLOT_3, RENTAL_1,
				null, BOOT_ID, "LOCK"
			);
		service.registerDeviceCommand(commandTwo);
		assertThrows(IdempotencyConflictException.class, () ->
			service.applyDeviceEvent(
				successfulEvent("conflict-event-1", commandTwo.commandId(), SLOT_3)
			)
		);
		assertEquals(0, count("""
			SELECT COUNT(*) FROM device_operation
			WHERE command_id = 'conflict-command-2'
			  AND event_id IS NOT NULL
			"""));
		assertEquals("EMPTY", text("""
			SELECT occupancy_status FROM slot WHERE slot_id = ?
			""", SLOT_3));

		service.approvePayment(
			new PaymentApproval(PAYMENT_1, ORDER_1, "shared-payment-key", 1000)
		);
		assertThrows(IdempotencyConflictException.class, () ->
			service.approvePayment(
				new PaymentApproval(PAYMENT_2, ORDER_2, "shared-payment-key", 2000)
			)
		);
		assertEquals("REQUESTED", text("""
			SELECT status FROM payment_attempt WHERE payment_attempt_id = ?
			""", PAYMENT_2));
		assertNull(text("""
			SELECT toss_payment_key FROM payment_attempt WHERE payment_attempt_id = ?
			""", PAYMENT_2));
		assertEquals("PENDING", text("""
			SELECT status FROM settlement WHERE settlement_id = ?
			""", SETTLEMENT_2));
	}

	private DeviceEvent successfulEvent(String eventId, String commandId, String slotId) {
		return new DeviceEvent(
			eventId,
			commandId,
			BOOT_ID,
			slotId,
			"OCCUPIED",
			"LOCKED",
			true,
			"OK",
			EVENT_TIME
		);
	}

	private <T> List<T> runConcurrently(Callable<T> operation) throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(2);
		CountDownLatch ready = new CountDownLatch(2);
		CountDownLatch start = new CountDownLatch(1);
		Callable<T> synchronizedOperation = () -> {
			ready.countDown();
			if (!start.await(5, TimeUnit.SECONDS)) {
				throw new IllegalStateException("Concurrent test start timed out");
			}
			return operation.call();
		};

		try {
			Future<T> first = executor.submit(synchronizedOperation);
			Future<T> second = executor.submit(synchronizedOperation);
			assertTrue(ready.await(5, TimeUnit.SECONDS));
			start.countDown();
			return List.of(
				first.get(15, TimeUnit.SECONDS),
				second.get(15, TimeUnit.SECONDS)
			);
		} finally {
			executor.shutdownNow();
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

	private LocalDateTime dateTime(String sql, Object... arguments) {
		return jdbcTemplate.queryForObject(sql, LocalDateTime.class, arguments);
	}
}
