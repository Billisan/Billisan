package dev.billisan.slot.dto;

import dev.billisan.inspection.domain.DamageInspection;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** 이미지·얼굴 정보는 절대 넣지 않는다 — 필드 추가 시 이 원칙부터 재확인할 것. */
public record LatestInspectionView(
        UUID inspectionId,
        String aiResult,
        BigDecimal aiScore,
        String modelVersion,
        LocalDateTime processedAt,
        String reviewStatus,
        String decision
) {
    public static LatestInspectionView of(DamageInspection inspection) {
        boolean failed = inspection.getStatus() == DamageInspection.ProcessStatus.FAILED;
        return new LatestInspectionView(
                inspection.getInspectionId(),
                failed ? "FAILED" : inspection.getAiResult() == null ? null : inspection.getAiResult().name(),
                inspection.getConfidence(),
                inspection.getModelVersion(),
                inspection.getCompletedAt(),
                inspection.reviewStatus().name(),
                inspection.getAdminDecision() == null ? null : inspection.getAdminDecision().name());
    }
}
