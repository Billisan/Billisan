package dev.billisan.returns.repository;

import dev.billisan.returns.domain.ReturnAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface ReturnAttemptRepository extends JpaRepository<ReturnAttempt, UUID> {

    Optional<ReturnAttempt> findFirstByReturnSlotIdOrderByCreatedAtDesc(UUID returnSlotId);

    /** EDGE-RETURN-001 — requestId 멱등 사전조회. */
    Optional<ReturnAttempt> findByRequestId(String requestId);
}
