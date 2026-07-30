package dev.billisan.faceprofilesync;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
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

import dev.billisan.faceprofilesync.FaceProfileSyncOperationEntity.OperationType;
import dev.billisan.faceprofilesync.FaceProfileSyncOperationEntity.SyncStatus;
import dev.billisan.faceprofilesync.FaceProfileSyncService.Outcome;
import dev.billisan.faceprofilesync.FaceProfileSyncService.SyncRequest;
import dev.billisan.faceprofilesync.FaceProfileSyncService.SyncResult;

@Testcontainers
@SpringBootTest
class FaceProfileSyncServiceTests {

	private static final String USER_ID = "100000010";
	private static final String USER_REF =
		"10000000-0000-0000-0000-000000000010";
	private static final String CONFIRM_REQUEST_ID =
		"face-sync-confirm-concurrent";
	private static final String NEW_REQUEST_ID =
		"face-sync-request-concurrent";

	@Container
	private static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.0")
		.withDatabaseName("billisan_face_sync_test")
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
	private FaceProfileSyncService service;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@BeforeEach
	void resetFaceSyncData() {
		jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 0");
		try {
			jdbcTemplate.execute("TRUNCATE TABLE face_profile_sync_operation");
			jdbcTemplate.execute("TRUNCATE TABLE user_account");
		} finally {
			jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1");
		}

		LocalDateTime baseline = LocalDateTime.now(ZoneOffset.UTC)
			.minusMinutes(1)
			.withNano(0);
		jdbcTemplate.update("""
			INSERT INTO user_account (
				user_id, user_ref, login_id, password_hash, name,
				face_registered, created_at, updated_at
			) VALUES (
				?, ?, 'face-sync-test@example.com', '{noop}test-password',
				'Face Sync Test User', FALSE, ?, ?
			)
			""",
			USER_ID,
			USER_REF,
			baseline,
			baseline
		);
	}

	@Test
	void requestAndConfirmForSameUserCompleteWithoutDeadlock() throws Exception {
		service.request(new SyncRequest(
			CONFIRM_REQUEST_ID,
			USER_REF,
			OperationType.REGISTER,
			1
		));
		service.markProcessing(CONFIRM_REQUEST_ID);

		ExecutorService executor = Executors.newFixedThreadPool(2);
		CountDownLatch ready = new CountDownLatch(2);
		CountDownLatch start = new CountDownLatch(1);
		try {
			Future<SyncResult> requestResult = executor.submit(() -> {
				awaitStart(ready, start);
				return service.request(new SyncRequest(
					NEW_REQUEST_ID,
					USER_REF,
					OperationType.REREGISTER,
					2
				));
			});
			Future<SyncResult> confirmResult = executor.submit(() -> {
				awaitStart(ready, start);
				return service.confirmSuccess(CONFIRM_REQUEST_ID, 1);
			});

			assertTrue(ready.await(5, TimeUnit.SECONDS));
			start.countDown();
			SyncResult requested = requestResult.get(15, TimeUnit.SECONDS);
			SyncResult confirmed = confirmResult.get(15, TimeUnit.SECONDS);

			assertEquals(Outcome.APPLIED, requested.outcome());
			assertEquals(SyncStatus.REQUESTED, requested.syncStatus());
			assertEquals(Outcome.APPLIED, confirmed.outcome());
			assertEquals(SyncStatus.SUCCEEDED, confirmed.syncStatus());
			assertEquals(2, count("""
				SELECT COUNT(*) FROM face_profile_sync_operation
				WHERE user_ref = ?
				""", USER_REF));
			assertEquals(1, count("""
				SELECT COUNT(*) FROM user_account
				WHERE user_ref = ? AND face_registered = TRUE
				""", USER_REF));
		} finally {
			executor.shutdownNow();
		}
	}

	private static void awaitStart(
		CountDownLatch ready,
		CountDownLatch start
	) throws InterruptedException {
		ready.countDown();
		if (!start.await(5, TimeUnit.SECONDS)) {
			throw new IllegalStateException("Concurrent test start timed out");
		}
	}

	private int count(String sql, Object... arguments) {
		Integer value = jdbcTemplate.queryForObject(sql, Integer.class, arguments);
		if (value == null) {
			throw new IllegalStateException("COUNT query returned null");
		}
		return value;
	}
}
