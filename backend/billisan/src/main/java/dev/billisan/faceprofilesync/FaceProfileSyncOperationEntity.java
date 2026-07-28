package dev.billisan.faceprofilesync;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "face_profile_sync_operation")
public class FaceProfileSyncOperationEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "request_id", nullable = false, unique = true, length = 100)
	private String requestId;

	@Column(
		name = "user_id",
		nullable = false,
		length = 36,
		columnDefinition = "char(36)"
	)
	private String userId;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.VARCHAR)
	@Column(name = "operation_type", nullable = false, length = 20)
	private OperationType operationType;

	@Column(name = "template_version")
	private Integer templateVersion;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.VARCHAR)
	@Column(name = "sync_status", nullable = false, length = 40)
	private SyncStatus syncStatus;

	@Column(name = "last_error_code", length = 80)
	private String lastErrorCode;

	@Column(name = "requested_at", nullable = false)
	private LocalDateTime requestedAt;

	@Column(name = "completed_at")
	private LocalDateTime completedAt;

	@Column(name = "created_at", nullable = false)
	private LocalDateTime createdAt;

	@Column(name = "updated_at", nullable = false)
	private LocalDateTime updatedAt;

	protected FaceProfileSyncOperationEntity() {
	}

	static FaceProfileSyncOperationEntity requested(
		String requestId,
		String userId,
		OperationType operationType,
		LocalDateTime now
	) {
		FaceProfileSyncOperationEntity operation =
			new FaceProfileSyncOperationEntity();
		operation.requestId = requestId;
		operation.userId = userId;
		operation.operationType = operationType;
		operation.syncStatus = SyncStatus.REQUESTED;
		operation.requestedAt = now;
		operation.createdAt = now;
		operation.updatedAt = now;
		return operation;
	}

	void markProcessing(LocalDateTime now) {
		if (syncStatus == SyncStatus.REQUESTED) {
			syncStatus = SyncStatus.PROCESSING;
			updatedAt = now;
			return;
		}
		if (syncStatus != SyncStatus.PROCESSING) {
			throw new IllegalStateException(
				"Only a requested operation can start processing"
			);
		}
	}

	void markSucceeded(Integer confirmedTemplateVersion, LocalDateTime now) {
		if (syncStatus == SyncStatus.SUCCEEDED) {
			return;
		}
		if (syncStatus != SyncStatus.PROCESSING
			&& syncStatus != SyncStatus.RECONCILIATION_REQUIRED) {
			throw new IllegalStateException(
				"Operation is not awaiting an Orin result"
			);
		}
		if (operationType != OperationType.DELETE
			&& (confirmedTemplateVersion == null
				|| confirmedTemplateVersion < 1)) {
			throw new IllegalArgumentException(
				"Successful registration requires templateVersion"
			);
		}
		templateVersion = operationType == OperationType.DELETE
			? null
			: confirmedTemplateVersion;
		syncStatus = SyncStatus.SUCCEEDED;
		lastErrorCode = null;
		completedAt = now;
		updatedAt = now;
	}

	void markFailed(String errorCode, LocalDateTime now) {
		if (errorCode == null || errorCode.isBlank()) {
			throw new IllegalArgumentException("errorCode must not be blank");
		}
		if (syncStatus == SyncStatus.SUCCEEDED) {
			throw new IllegalStateException(
				"A succeeded operation cannot be changed to failed"
			);
		}
		if (syncStatus == SyncStatus.FAILED
			&& errorCode.equals(lastErrorCode)) {
			return;
		}
		syncStatus = SyncStatus.FAILED;
		lastErrorCode = errorCode;
		completedAt = now;
		updatedAt = now;
	}

	void requireReconciliation(String errorCode, LocalDateTime now) {
		if (errorCode == null || errorCode.isBlank()) {
			throw new IllegalArgumentException("errorCode must not be blank");
		}
		if (syncStatus == SyncStatus.SUCCEEDED) {
			throw new IllegalStateException(
				"A succeeded operation cannot require reconciliation"
			);
		}
		if (syncStatus == SyncStatus.RECONCILIATION_REQUIRED
			&& errorCode.equals(lastErrorCode)) {
			return;
		}
		syncStatus = SyncStatus.RECONCILIATION_REQUIRED;
		lastErrorCode = errorCode;
		completedAt = null;
		updatedAt = now;
	}

	public Long getId() {
		return id;
	}

	public String getRequestId() {
		return requestId;
	}

	public String getUserId() {
		return userId;
	}

	public OperationType getOperationType() {
		return operationType;
	}

	public Integer getTemplateVersion() {
		return templateVersion;
	}

	public SyncStatus getSyncStatus() {
		return syncStatus;
	}

	public String getLastErrorCode() {
		return lastErrorCode;
	}

	public LocalDateTime getRequestedAt() {
		return requestedAt;
	}

	public LocalDateTime getCompletedAt() {
		return completedAt;
	}

	public LocalDateTime getCreatedAt() {
		return createdAt;
	}

	public LocalDateTime getUpdatedAt() {
		return updatedAt;
	}

	public enum OperationType {
		REGISTER,
		REREGISTER,
		DELETE
	}

	public enum SyncStatus {
		REQUESTED,
		PROCESSING,
		SUCCEEDED,
		FAILED,
		RECONCILIATION_REQUIRED
	}
}
