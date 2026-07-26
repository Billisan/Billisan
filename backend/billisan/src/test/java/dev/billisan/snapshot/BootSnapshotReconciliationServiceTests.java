package dev.billisan.snapshot;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;

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

import dev.billisan.snapshot.BootSnapshotReconciliationService.BootSnapshotCommand;
import dev.billisan.snapshot.BootSnapshotReconciliationService.BootSnapshotResult;
import dev.billisan.snapshot.BootSnapshotReconciliationService.LockStatus;
import dev.billisan.snapshot.BootSnapshotReconciliationService.OccupancyStatus;
import dev.billisan.snapshot.BootSnapshotReconciliationService.Outcome;
import dev.billisan.snapshot.BootSnapshotReconciliationService.ReconciliationStatus;
import dev.billisan.snapshot.BootSnapshotReconciliationService.RecoveryScope;
import dev.billisan.snapshot.BootSnapshotReconciliationService.SensorHealth;
import dev.billisan.snapshot.BootSnapshotReconciliationService.SnapshotSlot;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Testcontainers
@SpringBootTest
class BootSnapshotReconciliationServiceTests {

	private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

	private static final String USER_ID =
		"10000000-0000-0000-0000-000000000010";
	private static final String STATION_ID =
		"20000000-0000-0000-0000-000000000001";
	private static final String SLOT_ONE_ID =
		"30000000-0000-0000-0000-000000000001";
	private static final String SLOT_TWO_ID =
		"30000000-0000-0000-0000-000000000002";
	private static final String RENTAL_ID =
		"40000000-0000-0000-0000-000000000010";
	private static final String RETURN_ATTEMPT_ID =
		"50000000-0000-0000-0000-000000000010";

	@Container
	private static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.0")
		.withDatabaseName("billisan_boot_snapshot_test")
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
	private BootSnapshotReconciliationService service;

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
		jdbcTemplate.update("DELETE FROM user_account");

		LocalDateTime baseline = LocalDateTime.of(2026, 7, 26, 9, 0);
		jdbcTemplate.update("""
			INSERT INTO user_account (
				user_id, login_id, role, account_status, face_registered,
				created_at, updated_at
			) VALUES (?, 'step10-user', 'USER', 'ACTIVE', FALSE, ?, ?)
			""",
			USER_ID,
			baseline,
			baseline
		);
		jdbcTemplate.update("""
			INSERT INTO station (
				station_id, station_code, name, service_status,
				device_status, updated_at
			) VALUES (?, 'STEP10-STATION', 'STEP-10 Test Station',
				'AVAILABLE', 'ONLINE', ?)
			""",
			STATION_ID,
			baseline
		);
		jdbcTemplate.update("""
			INSERT INTO slot (
				slot_id, station_id, slot_number, item_condition,
				service_status, occupancy_status, lock_status, updated_at
			) VALUES (?, ?, 1, NULL, 'AVAILABLE', 'EMPTY', 'LOCKED', ?)
			""",
			SLOT_ONE_ID,
			STATION_ID,
			baseline
		);
		jdbcTemplate.update("""
			INSERT INTO slot (
				slot_id, station_id, slot_number, item_condition,
				service_status, occupancy_status, lock_status, updated_at
			) VALUES (?, ?, 2, 'NORMAL', 'AVAILABLE', 'OCCUPIED', 'LOCKED', ?)
			""",
			SLOT_TWO_ID,
			STATION_ID,
			baseline
		);
		jdbcTemplate.update("""
			INSERT INTO rental (
				rental_id, user_id, checkout_slot_id, rental_request_id, status,
				requested_at, rented_at, due_at
			) VALUES (?, ?, ?, 'step10-rental-request', 'ACTIVE', ?, ?, ?)
			""",
			RENTAL_ID,
			USER_ID,
			SLOT_TWO_ID,
			baseline,
			baseline,
			baseline.plusDays(1)
		);
		jdbcTemplate.update("""
			INSERT INTO return_attempt (
				return_attempt_id, rental_id, return_slot_id, request_id,
				status, created_at
			) VALUES (?, ?, ?, 'step10-return-request', 'PROCESSING', ?)
			""",
			RETURN_ATTEMPT_ID,
			RENTAL_ID,
			SLOT_ONE_ID,
			baseline
		);
	}

	@Test
	void matchingSnapshotKeepsEveryBusinessState() throws IOException {
		BootSnapshotResult result =
			service.reconcile(command("boot-snapshot-match.json"));

		assertEquals(ReconciliationStatus.MATCHED, result.status());
		assertEquals(RecoveryScope.NONE, result.recoveryScope());
		assertEquals(Outcome.APPLIED, result.outcome());
		assertEquals(0, result.mismatchCount());
		assertStation("AVAILABLE", "ONLINE", null);
		assertSlot(SLOT_ONE_ID, "AVAILABLE", "EMPTY", "LOCKED", null);
		assertSlot(SLOT_TWO_ID, "AVAILABLE", "OCCUPIED", "LOCKED", null);
		assertEquals("PROCESSING", returnAttemptStatus());
	}

	@Test
	void occupancyMismatchMovesOnlyTheAffectedSlotToManualRecovery()
		throws IOException {
		BootSnapshotResult result =
			service.reconcile(command("boot-snapshot-mismatch.json"));

		assertEquals(ReconciliationStatus.RECOVERY_REQUIRED, result.status());
		assertEquals(RecoveryScope.SLOT, result.recoveryScope());
		assertEquals(1, result.mismatchCount());
		assertEquals(
			List.of("OCCUPANCY_MISMATCH"),
			result.slotDifferences().getFirst().reasons()
		);
		assertStation("AVAILABLE", "ONLINE", null);
		assertSlot(
			SLOT_ONE_ID,
			"ADMIN_REVIEW",
			"EMPTY",
			"LOCKED",
			"OCCUPANCY_MISMATCH"
		);
		assertSlot(SLOT_TWO_ID, "AVAILABLE", "OCCUPIED", "LOCKED", null);
		assertEquals("RECOVERY_REQUIRED", returnAttemptStatus());
		assertEquals("BOOT_SNAPSHOT_MISMATCH", returnAttemptFailureReason());
	}

	@Test
	void lockMismatchDoesNotOverwriteTheStoredPhysicalState()
		throws IOException {
		BootSnapshotResult result =
			service.reconcile(command("boot-snapshot-lock-mismatch.json"));

		assertEquals(ReconciliationStatus.RECOVERY_REQUIRED, result.status());
		assertEquals(RecoveryScope.SLOT, result.recoveryScope());
		assertEquals(
			List.of("LOCK_MISMATCH"),
			result.slotDifferences().getFirst().reasons()
		);
		assertStation("AVAILABLE", "ONLINE", null);
		assertSlot(
			SLOT_ONE_ID,
			"ADMIN_REVIEW",
			"EMPTY",
			"LOCKED",
			"LOCK_MISMATCH"
		);
		assertEquals("RECOVERY_REQUIRED", returnAttemptStatus());
	}

	@Test
	void unknownSlotEscalatesTheStationWithoutCreatingAUnknownSlot()
		throws IOException {
		BootSnapshotResult result =
			service.reconcile(command("boot-snapshot-unknown-slot.json"));

		assertEquals(ReconciliationStatus.RECOVERY_REQUIRED, result.status());
		assertEquals(RecoveryScope.STATION, result.recoveryScope());
		assertEquals(
			List.of("30000000-0000-0000-0000-000000000099"),
			result.unknownSlotIds()
		);
		assertStation("MAINTENANCE", "ERROR", "UNKNOWN_SLOT");
		assertEquals(2, count("""
			SELECT COUNT(*) FROM slot WHERE station_id = ?
			  AND service_status = 'ADMIN_REVIEW'
			""", STATION_ID));
		assertEquals(0, count("""
			SELECT COUNT(*) FROM slot
			WHERE slot_id = '30000000-0000-0000-0000-000000000099'
			"""));
		assertEquals("RECOVERY_REQUIRED", returnAttemptStatus());
	}

	@Test
	void unknownStationRejectsTheSnapshotWithoutChangingKnownState()
		throws IOException {
		BootSnapshotCommand valid = command("boot-snapshot-match.json");
		BootSnapshotCommand unknownStation = new BootSnapshotCommand(
			"20000000-0000-0000-0000-000000000099",
			valid.bootId(),
			valid.deviceId(),
			valid.measuredAt(),
			valid.slots()
		);

		BootSnapshotRejectedException exception = assertThrows(
			BootSnapshotRejectedException.class,
			() -> service.reconcile(unknownStation)
		);

		assertEquals(
			BootSnapshotRejectedException.Reason.UNKNOWN_STATION,
			exception.getReason()
		);
		assertStation("AVAILABLE", "ONLINE", null);
		assertNull(text("""
			SELECT last_boot_id FROM station WHERE station_id = ?
			""", STATION_ID));
		assertEquals("PROCESSING", returnAttemptStatus());
	}

	@Test
	void duplicateSnapshotDoesNotRepeatStateChanges() throws IOException {
		BootSnapshotCommand command = command("boot-snapshot-mismatch.json");
		BootSnapshotResult first = service.reconcile(command);
		LocalDateTime stationUpdatedAfterFirst = dateTime("""
			SELECT updated_at FROM station WHERE station_id = ?
			""", STATION_ID);
		LocalDateTime slotUpdatedAfterFirst = dateTime("""
			SELECT updated_at FROM slot WHERE slot_id = ?
			""", SLOT_ONE_ID);

		BootSnapshotResult replay = service.reconcile(command);

		assertEquals(Outcome.APPLIED, first.outcome());
		assertEquals(Outcome.REPLAYED, replay.outcome());
		assertEquals(ReconciliationStatus.RECOVERY_REQUIRED, replay.status());
		assertEquals(stationUpdatedAfterFirst, dateTime("""
			SELECT updated_at FROM station WHERE station_id = ?
			""", STATION_ID));
		assertEquals(slotUpdatedAfterFirst, dateTime("""
			SELECT updated_at FROM slot WHERE slot_id = ?
			""", SLOT_ONE_ID));
		assertEquals("RECOVERY_REQUIRED", returnAttemptStatus());
	}

	@Test
	void incompleteSnapshotEscalatesTheWholeStation() throws IOException {
		BootSnapshotResult result =
			service.reconcile(command("boot-snapshot-partial.json"));

		assertEquals(ReconciliationStatus.RECOVERY_REQUIRED, result.status());
		assertEquals(RecoveryScope.STATION, result.recoveryScope());
		assertEquals(List.of(SLOT_TWO_ID), result.missingSlotIds());
		assertStation("MAINTENANCE", "ERROR", "INCOMPLETE_SNAPSHOT");
		assertEquals(2, count("""
			SELECT COUNT(*) FROM slot WHERE station_id = ?
			  AND service_status = 'ADMIN_REVIEW'
			""", STATION_ID));
		assertEquals(
			"MISSING_FROM_SNAPSHOT",
			text("""
				SELECT snapshot_recovery_reason FROM slot WHERE slot_id = ?
				""", SLOT_TWO_ID)
		);
		assertEquals("RECOVERY_REQUIRED", returnAttemptStatus());
	}

	@Test
	void laterMatchingSnapshotDoesNotAutoClearManualRecovery()
		throws IOException {
		service.reconcile(command("boot-snapshot-mismatch.json"));
		BootSnapshotCommand matching = command("boot-snapshot-match.json");
		BootSnapshotCommand laterMatching = new BootSnapshotCommand(
			matching.stationId(),
			"a1000000-0000-0000-0000-000000000006",
			matching.deviceId(),
			OffsetDateTime.parse("2026-07-26T20:11:00+09:00"),
			matching.slots()
		);

		BootSnapshotResult result = service.reconcile(laterMatching);

		assertEquals(ReconciliationStatus.RECOVERY_REQUIRED, result.status());
		assertEquals(RecoveryScope.SLOT, result.recoveryScope());
		assertEquals(0, result.mismatchCount());
		assertSlot(
			SLOT_ONE_ID,
			"ADMIN_REVIEW",
			"EMPTY",
			"LOCKED",
			"OCCUPANCY_MISMATCH"
		);
		assertEquals("RECOVERY_REQUIRED", returnAttemptStatus());
	}

	@Test
	void sameBootIdWithDifferentPayloadIsAnIdempotencyConflict()
		throws IOException {
		BootSnapshotCommand matching = command("boot-snapshot-match.json");
		service.reconcile(matching);
		List<SnapshotSlot> changedSlots = List.of(
			new SnapshotSlot(
				SLOT_ONE_ID,
				1,
				OccupancyStatus.OCCUPIED,
				LockStatus.LOCKED,
				SensorHealth.NORMAL
			),
			matching.slots().get(1)
		);
		BootSnapshotCommand conflicting = new BootSnapshotCommand(
			matching.stationId(),
			matching.bootId(),
			matching.deviceId(),
			matching.measuredAt(),
			changedSlots
		);

		BootSnapshotRejectedException exception = assertThrows(
			BootSnapshotRejectedException.class,
			() -> service.reconcile(conflicting)
		);

		assertEquals(
			BootSnapshotRejectedException.Reason.IDEMPOTENCY_CONFLICT,
			exception.getReason()
		);
		assertSlot(SLOT_ONE_ID, "AVAILABLE", "EMPTY", "LOCKED", null);
		assertEquals("PROCESSING", returnAttemptStatus());
	}

	private BootSnapshotCommand command(String fixture) throws IOException {
		try (InputStream input = requireResource(fixture)) {
			JsonNode root = OBJECT_MAPPER.readTree(input);
			List<SnapshotSlot> slots = root.path("slots")
				.valueStream()
				.map(slot -> new SnapshotSlot(
					slot.path("slotId").asString(),
					slot.path("slotNumber").intValue(),
					OccupancyStatus.valueOf(
						slot.path("occupancyStatus").asString()
					),
					LockStatus.valueOf(slot.path("lockStatus").asString()),
					SensorHealth.valueOf(slot.path("sensorHealth").asString())
				))
				.toList();
			return new BootSnapshotCommand(
				STATION_ID,
				root.path("bootId").asString(),
				root.path("deviceId").asString(),
				OffsetDateTime.parse(root.path("measuredAt").asString()),
				slots
			);
		}
	}

	private InputStream requireResource(String fixture) {
		InputStream input = getClass().getResourceAsStream(
			"/device-contract/v1/" + fixture
		);
		if (input == null) {
			throw new IllegalArgumentException("Missing fixture: " + fixture);
		}
		return input;
	}

	private void assertStation(
		String serviceStatus,
		String deviceStatus,
		String recoveryReason
	) {
		assertEquals(serviceStatus, text("""
			SELECT service_status FROM station WHERE station_id = ?
			""", STATION_ID));
		assertEquals(deviceStatus, text("""
			SELECT device_status FROM station WHERE station_id = ?
			""", STATION_ID));
		assertEquals(recoveryReason, text("""
			SELECT snapshot_recovery_reason FROM station WHERE station_id = ?
			""", STATION_ID));
	}

	private void assertSlot(
		String slotId,
		String serviceStatus,
		String occupancyStatus,
		String lockStatus,
		String recoveryReason
	) {
		assertEquals(serviceStatus, text("""
			SELECT service_status FROM slot WHERE slot_id = ?
			""", slotId));
		assertEquals(occupancyStatus, text("""
			SELECT occupancy_status FROM slot WHERE slot_id = ?
			""", slotId));
		assertEquals(lockStatus, text("""
			SELECT lock_status FROM slot WHERE slot_id = ?
			""", slotId));
		assertEquals(recoveryReason, text("""
			SELECT snapshot_recovery_reason FROM slot WHERE slot_id = ?
			""", slotId));
	}

	private String returnAttemptStatus() {
		return text("""
			SELECT status FROM return_attempt WHERE return_attempt_id = ?
			""", RETURN_ATTEMPT_ID);
	}

	private String returnAttemptFailureReason() {
		return text("""
			SELECT failure_reason FROM return_attempt WHERE return_attempt_id = ?
			""", RETURN_ATTEMPT_ID);
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
