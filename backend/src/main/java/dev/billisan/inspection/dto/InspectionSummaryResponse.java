package dev.billisan.inspection.dto;

import dev.billisan.inspection.domain.DamageInspection;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record InspectionSummaryResponse(
        UUID inspectionId,
        UUID returnAttemptId,
        UUID stationId,
        UUID slotId,
        String aiResult,
        BigDecimal aiScore,
        String modelVersion,
        LocalDateTime processedAt,
        String reviewStatus,
        LocalDateTime updatedAt
) {
    public static InspectionSummaryResponse of(DamageInspection inspection, UUID stationId, UUID slotId) {
        boolean failed = inspection.getStatus() == DamageInspection.ProcessStatus.FAILED;
        return new InspectionSummaryResponse(
                inspection.getInspectionId(),
                inspection.getReturnAttemptId(),
                stationId,
                slotId,
                failed ? "FAILED" : inspection.getAiResult() == null ? null : inspection.getAiResult().name(),
                inspection.getConfidence(),
                inspection.getModelVersion(),
                inspection.getCompletedAt(),
                inspection.reviewStatus().name(),
                inspection.getUpdatedAt());
    }
}
