package dev.billisan.inspection.dto;

import dev.billisan.inspection.domain.DamageInspection;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * ⚠️ 목록 항목엔 {@code slotId}를 넣지 않는다 — {@code damage_inspection}엔 slot_id가 없어
 * 행마다 return_attempt 조회가 필요한데, 목록 전체에 그걸 하면 N+1이 된다. 대신
 * {@code returnAttemptId}를 노출한다. 슬롯 상태까지 필요하면 상세(ADMIN-INSPECTION-002)를
 * 호출할 것.
 */
public record InspectionSummaryResponse(
        UUID inspectionId,
        UUID returnAttemptId,
        String aiResult,
        BigDecimal aiScore,
        String modelVersion,
        LocalDateTime processedAt,
        String reviewStatus
) {
    public static InspectionSummaryResponse of(DamageInspection inspection) {
        return new InspectionSummaryResponse(
                inspection.getInspectionId(),
                inspection.getReturnAttemptId(),
                inspection.getAiResult() == null ? null : inspection.getAiResult().name(),
                inspection.getConfidence(),
                inspection.getModelVersion(),
                inspection.getCompletedAt(),
                inspection.reviewStatus().name());
    }
}
