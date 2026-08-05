package dev.billisan.returns.repository;

import dev.billisan.returns.domain.ReturnAttempt;
import dev.billisan.returns.domain.ReturnAttempt.Status;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReturnAttemptRepository extends JpaRepository<ReturnAttempt, UUID> {

    Optional<ReturnAttempt> findFirstByReturnSlotIdOrderByCreatedAtDesc(UUID returnSlotId);

    /** EDGE-RETURN-001 — requestId 멱등 사전조회. */
    Optional<ReturnAttempt> findByRequestId(String requestId);

    /**
     * EDGE-RETURN-003 — returnAttemptId가 자연 멱등 키라, findById(비잠금)만 쓰면 같은
     * returnAttemptId가 거의 동시에 재전송됐을 때 두 트랜잭션이 똑같이 return_slot_id=NULL을
     * 읽고 서로 다른 슬롯을 배정해버리는 lost update가 가능하다 — 조회 시점에 행을 잠근다
     * (SlotRepository.findByIdForUpdate와 동일 이유, ReturnAttempt엔 @Version이 없다).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select ra from ReturnAttempt ra where ra.returnAttemptId = :returnAttemptId")
    Optional<ReturnAttempt> findByIdForUpdate(@Param("returnAttemptId") UUID returnAttemptId);

    Optional<ReturnAttempt> findFirstByRentalIdOrderByCreatedAtDesc(UUID rentalId);

    /** 완료 시도는 대여당 최대 1건(CLAUDE.md) — 이력 목록의 반납 대여소명 배치 조회용. */
    List<ReturnAttempt> findByRentalIdInAndStatus(List<UUID> rentalIds, Status status);

    List<ReturnAttempt> findByRentalIdIn(List<UUID> rentalIds);
}
