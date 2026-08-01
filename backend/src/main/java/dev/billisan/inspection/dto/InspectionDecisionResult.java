package dev.billisan.inspection.dto;

import dev.billisan.inspection.domain.DamageInspection;
import dev.billisan.settlement.domain.Settlement;
import dev.billisan.slot.domain.Slot;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * ADMIN-INSPECTION-003(PATCH) 전용 응답. GET 상세({@link InspectionDetailResponse})와
 * 달리 {@code slot}·{@code settlement}가 중첩 객체로 온다 — 관리자 웹이 이 형태를 기대한다.
 */
public record InspectionDecisionResult(
        UUID inspectionId,
        String reviewStatus,
        String decision,
        UUID decidedBy,
        LocalDateTime decidedAt,
        SlotState slot,
        SettlementState settlement,
        LocalDateTime updatedAt
) {
    /**
     * {@code appliedDecision}은 요청의 decision을 그대로 반영한다 — KEEP_ADMIN_REVIEW는
     * 저장되는 판정값이 아니라서 {@code inspection.getAdminDecision()}만으로는 복원되지 않는다.
     */
    public static InspectionDecisionResult of(
            DamageInspection inspection, String appliedDecision, Slot slot, Settlement settlement) {
        return new InspectionDecisionResult(
                inspection.getInspectionId(),
                inspection.reviewStatus().name(),
                appliedDecision,
                inspection.getReviewedBy(),
                inspection.getReviewedAt(),
                SlotState.of(slot),
                settlement == null ? null : SettlementState.of(settlement),
                inspection.getUpdatedAt());
    }

    public record SlotState(
            UUID slotId,
            String occupancyStatus,
            String itemCondition,
            String serviceStatus,
            String lockStatus,
            LocalDateTime updatedAt
    ) {
        public static SlotState of(Slot slot) {
            return new SlotState(
                    slot.getSlotId(),
                    slot.getOccupancyStatus().name(),
                    slot.getItemCondition() == null ? null : slot.getItemCondition().name(),
                    slot.getServiceStatus().name(),
                    slot.getLockStatus().name(),
                    slot.getUpdatedAt());
        }
    }

    /** {@code reason}은 P0 범위상 이 응답에서 항상 {@code DAMAGE}다 — 이 서비스가 만드는 정산은 파손 정산뿐. */
    public record SettlementState(
            UUID settlementId,
            String reason,
            long amount,
            long paidAmount,
            long outstandingAmount,
            String status
    ) {
        public static SettlementState of(Settlement settlement) {
            return new SettlementState(
                    settlement.getSettlementId(),
                    settlement.getReason().name(),
                    settlement.getAmount(),
                    settlement.getPaidAmount(),
                    settlement.getAmount() - settlement.getPaidAmount(),
                    settlement.getStatus().name());
        }
    }
}
