package dev.billisan.inspection.dto;

import dev.billisan.inspection.domain.DamageInspection;
import dev.billisan.slot.domain.Slot;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * ⚠️ 이미지 존재 여부 필드조차 두지 않는다.
 * ⚠️ {@code decisionReasonCode}/{@code decisionNote}는 API 응답 필드이지만, 실제 스키마엔
 * 대응 컬럼이 없다 — 지금은 항상 {@code null}이다.
 */
public record InspectionDetailResponse(
        UUID inspectionId,
        UUID returnAttemptId,
        UUID rentalId,
        UUID slotId,
        String aiResult,
        BigDecimal aiScore,
        String modelVersion,
        LocalDateTime processedAt,
        String reviewStatus,
        String decision,
        String decisionReasonCode,
        String decisionNote,
        UUID decidedBy,
        LocalDateTime decidedAt,
        LocalDateTime updatedAt,
        String slotOccupancyStatus,
        String slotItemCondition,
        String slotServiceStatus,
        String slotLockStatus
) {
    public static InspectionDetailResponse of(DamageInspection inspection, Slot slot) {
        return new InspectionDetailResponse(
                inspection.getInspectionId(),
                inspection.getReturnAttemptId(),
                inspection.getRentalId(),
                slot.getSlotId(),
                inspection.getAiResult() == null ? null : inspection.getAiResult().name(),
                inspection.getConfidence(),
                inspection.getModelVersion(),
                inspection.getCompletedAt(),
                inspection.reviewStatus().name(),
                inspection.getAdminDecision() == null ? null : inspection.getAdminDecision().name(),
                null,
                null,
                inspection.getReviewedBy(),
                inspection.getReviewedAt(),
                inspection.getUpdatedAt(),
                slot.getOccupancyStatus().name(),
                slot.getItemCondition() == null ? null : slot.getItemCondition().name(),
                slot.getServiceStatus().name(),
                slot.getLockStatus().name());
    }
}
