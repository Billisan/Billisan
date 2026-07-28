package dev.billisan.faceprofilesync;

import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FaceProfileSyncOperationRepository
	extends JpaRepository<FaceProfileSyncOperationEntity, Long> {

	Optional<FaceProfileSyncOperationEntity> findByRequestId(String requestId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
		SELECT operation
		FROM FaceProfileSyncOperationEntity operation
		WHERE operation.requestId = :requestId
		""")
	Optional<FaceProfileSyncOperationEntity> lockByRequestId(
		@Param("requestId") String requestId
	);
}
