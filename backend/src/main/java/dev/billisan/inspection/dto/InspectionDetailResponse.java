package dev.billisan.inspection.dto;

import dev.billisan.inspection.domain.DamageInspection;
import dev.billisan.slot.domain.Slot;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** decisionReasonCode/decisionNote는 실제 스키마에 대응 컬럼이 없어 항상 null이다. */
public record InspectionDetailResponse(
        UUID inspectionId,
        UUID returnAttemptId,
        UUID rentalId,
        UUID stationId,
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
        boolean failed = inspection.getStatus() == DamageInspection.ProcessStatus.FAILED;
        return new InspectionDetailResponse(
                inspection.getInspectionId(),
                inspection.getReturnAttemptId(),
                inspection.getRentalId(),
                slot.getStationId(),
                slot.getSlotId(),
                failed ? "FAILED" : inspection.getAiResult() == null ? null : inspection.getAiResult().name(),
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
