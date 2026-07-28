package dev.billisan.faceprofilesync;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import dev.billisan.faceprofilesync.FaceProfileSyncOperationEntity.OperationType;
import dev.billisan.faceprofilesync.FaceProfileSyncOperationEntity.SyncStatus;

@Service
public class FaceProfileSyncService {

	private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");

	private final FaceProfileSyncOperationRepository repository;
	private final JdbcTemplate jdbcTemplate;

	public FaceProfileSyncService(
		FaceProfileSyncOperationRepository repository,
		JdbcTemplate jdbcTemplate
	) {
		this.repository = repository;
		this.jdbcTemplate = jdbcTemplate;
	}

	@Transactional
	public SyncResult request(SyncRequest request) {
		validate(request);
		lockUser(request.userId());
		FaceProfileSyncOperationEntity existing = repository
			.findByRequestId(request.requestId())
			.orElse(null);
		if (existing != null) {
			requireSameRequest(existing, request);
			return result(existing, Outcome.REPLAYED);
		}

		FaceProfileSyncOperationEntity created = repository.saveAndFlush(
			FaceProfileSyncOperationEntity.requested(
				request.requestId(),
				request.userId(),
				request.operationType(),
				now()
			)
		);
		return result(created, Outcome.APPLIED);
	}

	@Transactional
	public SyncResult markProcessing(String requestId) {
		FaceProfileSyncOperationEntity operation = lock(requestId);
		operation.markProcessing(now());
		return result(operation, Outcome.APPLIED);
	}

	@Transactional
	public SyncResult confirmSuccess(
		String requestId,
		Integer templateVersion
	) {
		FaceProfileSyncOperationEntity operation = lock(requestId);
		boolean replayed = operation.getSyncStatus() == SyncStatus.SUCCEEDED;
		LocalDateTime confirmedAt = now();
		operation.markSucceeded(templateVersion, confirmedAt);
		if (!replayed) {
			boolean registered =
				operation.getOperationType() != OperationType.DELETE;
			if (jdbcTemplate.update("""
				UPDATE user_account
				SET face_registered = ?,
				    updated_at = ?
				WHERE user_id = ?
				""",
				registered,
				confirmedAt,
				operation.getUserId()
			) != 1) {
				throw new IllegalStateException(
					"Face registration projection user does not exist"
				);
			}
		}
		return result(
			operation,
			replayed ? Outcome.REPLAYED : Outcome.APPLIED
		);
	}

	@Transactional
	public SyncResult markFailed(String requestId, String errorCode) {
		FaceProfileSyncOperationEntity operation = lock(requestId);
		operation.markFailed(errorCode, now());
		return result(operation, Outcome.APPLIED);
	}

	@Transactional
	public SyncResult requireReconciliation(
		String requestId,
		String errorCode
	) {
		FaceProfileSyncOperationEntity operation = lock(requestId);
		operation.requireReconciliation(errorCode, now());
		return result(operation, Outcome.APPLIED);
	}

	private FaceProfileSyncOperationEntity lock(String requestId) {
		requireText(requestId, "requestId");
		return repository.lockByRequestId(requestId)
			.orElseThrow(() -> new IllegalArgumentException(
				"Unknown face profile sync request"
			));
	}

	private void lockUser(String userId) {
		List<String> users = jdbcTemplate.queryForList("""
			SELECT user_id
			FROM user_account
			WHERE user_id = ?
			FOR UPDATE
			""", String.class, userId);
		if (users.size() != 1) {
			throw new IllegalArgumentException("Unknown userId");
		}
	}

	private static void requireSameRequest(
		FaceProfileSyncOperationEntity existing,
		SyncRequest request
	) {
		if (!existing.getUserId().equals(request.userId())
			|| existing.getOperationType() != request.operationType()) {
			throw new IllegalStateException(
				"IDEMPOTENCY_KEY_CONFLICT: " + request.requestId()
			);
		}
	}

	private static void validate(SyncRequest request) {
		Objects.requireNonNull(request, "request");
		requireText(request.requestId(), "requestId");
		requireText(request.userId(), "userId");
		Objects.requireNonNull(request.operationType(), "operationType");
	}

	private static void requireText(String value, String field) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException(field + " must not be blank");
		}
	}

	private static SyncResult result(
		FaceProfileSyncOperationEntity operation,
		Outcome outcome
	) {
		return new SyncResult(
			operation.getId(),
			operation.getRequestId(),
			operation.getUserId(),
			operation.getOperationType(),
			operation.getSyncStatus(),
			operation.getTemplateVersion(),
			operation.getLastErrorCode(),
			outcome
		);
	}

	private static LocalDateTime now() {
		LocalDateTime current = LocalDateTime.now(BUSINESS_ZONE);
		return current.withNano(current.getNano() / 1_000 * 1_000);
	}

	public enum Outcome {
		APPLIED,
		REPLAYED
	}

	public record SyncRequest(
		String requestId,
		String userId,
		OperationType operationType
	) {
	}

	public record SyncResult(
		Long id,
		String requestId,
		String userId,
		OperationType operationType,
		SyncStatus syncStatus,
		Integer templateVersion,
		String errorCode,
		Outcome outcome
	) {
	}
}
