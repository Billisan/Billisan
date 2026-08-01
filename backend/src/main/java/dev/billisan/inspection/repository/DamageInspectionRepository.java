package dev.billisan.inspection.repository;

import dev.billisan.inspection.domain.DamageInspection;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    /** 판정(decide) CAS의 lost update 방지용 — {@link SlotRepository#findByIdForUpdate}와 동일 이유. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from DamageInspection d where d.inspectionId = :inspectionId")
    Optional<DamageInspection> findByIdForUpdate(@Param("inspectionId") UUID inspectionId);
}
