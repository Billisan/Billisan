package dev.billisan.inspection.repository;

import dev.billisan.inspection.domain.DamageInspection;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * {@link JpaSpecificationExecutor}를 쓰는 이유: ADMIN-INSPECTION-001의 필터
 * (aiResult/reviewStatus/modelVersion/from/to)가 전부 선택값이다. 파생 쿼리로는
 * "값이 없으면 그 조건은 아예 무시" 의미를 표현할 수 없어(null을 넘기면 IS NULL 조건이
 * 돼버림) — 여기서만 {@code @Query}/파생 쿼리 대신 Specification을 쓴다.
 */
public interface DamageInspectionRepository extends JpaRepository<DamageInspection, UUID>,
        JpaSpecificationExecutor<DamageInspection> {

    /**
     * {@code damage_inspection}엔 {@code slot_id}가 없다(위 엔티티 Javadoc 참조) — 슬롯별
     * 최신 검수는 먼저 {@code return_attempt_id}를 알아낸 뒤 이 메서드로 조회한다.
     */
    Optional<DamageInspection> findFirstByReturnAttemptIdOrderByCreatedAtDesc(UUID returnAttemptId);

    /**
     * ALERT-001 — 미판정(reviewedBy IS NULL) + 비정상(aiResult가 NORMAL이 아니거나, 실패로
     * NULL) 검수만 rental과 조인해 사용자별로 직접 조회한다. 사용자의 전체 rentalId 목록을
     * 먼저 메모리에 올린 뒤 IN 절로 넘기지 않는다.
     */
    @Query("""
            select di from DamageInspection di
            join Rental r on r.rentalId = di.rentalId
            where r.userId = :userId
              and di.reviewedBy is null
              and (di.aiResult is null or di.aiResult <> :normal)
            """)
    List<DamageInspection> findRequiringReviewByUserId(
            @Param("userId") String userId, @Param("normal") DamageInspection.AiResult normal);

    /** 판정(decide) CAS의 lost update 방지용 — {@link SlotRepository#findByIdForUpdate}와 동일 이유. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from DamageInspection d where d.inspectionId = :inspectionId")
    Optional<DamageInspection> findByIdForUpdate(@Param("inspectionId") UUID inspectionId);
}
