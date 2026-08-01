package dev.billisan.inspection.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

/**
 * ADMIN-INSPECTION-003. 관리자 식별자는 요청에 없다 — 인증 세션의 adminId를 서버가 채운다.
 * ⚠️ {@code reasonCode}/{@code note}는 실제 스키마에 대응 컬럼이 없어 검증만 하고 저장하지
 * 않는다({@link dev.billisan.inspection.domain.DamageInspection} Javadoc 참조).
 *
 * {@code reasonCode}는 Bean Validation이 아니라 서비스 계층에서 직접 검증한다 — 비어있으면
 * 일반 400이 아니라 전용 {@code 422 ADMIN_REASON_REQUIRED}여야 하기 때문이다.
 */
public record InspectionDecisionRequest(
        @NotNull DecisionType decision,
        String reasonCode,
        String note,
        @AssertTrue(message = "physicalStateConfirmed는 현장 실물을 확인한 뒤에만 true로 보낼 수 있습니다.")
        boolean physicalStateConfirmed,
        @NotNull LocalDateTime expectedUpdatedAt
) {
    /** {@link dev.billisan.inspection.domain.DamageInspection.Decision}과 다른 이유:
     * KEEP_ADMIN_REVIEW는 저장되는 판정값이 아니라 "아직 판정 안 함"이라 엔티티엔 없다. */
    public enum DecisionType {
        NORMAL, DAMAGED, KEEP_ADMIN_REVIEW
    }
}
