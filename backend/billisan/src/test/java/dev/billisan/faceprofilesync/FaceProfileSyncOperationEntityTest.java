package dev.billisan.faceprofilesync;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;

import dev.billisan.faceprofilesync.FaceProfileSyncOperationEntity.OperationType;
import dev.billisan.faceprofilesync.FaceProfileSyncOperationEntity.SyncStatus;

class FaceProfileSyncOperationEntityTest {

	private static final LocalDateTime REQUESTED_AT =
		LocalDateTime.of(2026, 7, 28, 10, 0);

	@Test
	void registrationRequiresAConfirmedTemplateVersion() {
		FaceProfileSyncOperationEntity operation = requested(
			OperationType.REGISTER
		);
		operation.markProcessing(REQUESTED_AT.plusSeconds(1));

		assertThatThrownBy(() -> operation.markSucceeded(
			null,
			REQUESTED_AT.plusSeconds(2)
		)).isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void successfulRegistrationStoresTheTemplateVersion() {
		FaceProfileSyncOperationEntity operation = requested(
			OperationType.REREGISTER
		);
		operation.markProcessing(REQUESTED_AT.plusSeconds(1));
		operation.markSucceeded(3, REQUESTED_AT.plusSeconds(2));

		assertThat(operation.getSyncStatus()).isEqualTo(SyncStatus.SUCCEEDED);
		assertThat(operation.getTemplateVersion()).isEqualTo(3);
		assertThat(operation.getCompletedAt())
			.isEqualTo(REQUESTED_AT.plusSeconds(2));
	}

	@Test
	void deleteSuccessDoesNotStoreATemplateVersion() {
		FaceProfileSyncOperationEntity operation = requested(
			OperationType.DELETE
		);
		operation.markProcessing(REQUESTED_AT.plusSeconds(1));
		operation.markSucceeded(99, REQUESTED_AT.plusSeconds(2));

		assertThat(operation.getSyncStatus()).isEqualTo(SyncStatus.SUCCEEDED);
		assertThat(operation.getTemplateVersion()).isNull();
	}

	@Test
	void terminalSuccessCannotBeOverwrittenByFailureOrReconciliation() {
		FaceProfileSyncOperationEntity operation = requested(
			OperationType.REGISTER
		);
		operation.markProcessing(REQUESTED_AT.plusSeconds(1));
		operation.markSucceeded(1, REQUESTED_AT.plusSeconds(2));

		assertThatThrownBy(() -> operation.markFailed(
			"LATE_FAILURE",
			REQUESTED_AT.plusSeconds(3)
		)).isInstanceOf(IllegalStateException.class);
		assertThatThrownBy(() -> operation.requireReconciliation(
			"LATE_RECONCILIATION",
			REQUESTED_AT.plusSeconds(3)
		)).isInstanceOf(IllegalStateException.class);
	}

	private static FaceProfileSyncOperationEntity requested(
		OperationType operationType
	) {
		return FaceProfileSyncOperationEntity.requested(
			"face-sync-request-001",
			"00000000-0000-0000-0000-000000000001",
			operationType,
			REQUESTED_AT
		);
	}
}
