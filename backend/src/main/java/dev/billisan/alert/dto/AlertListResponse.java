package dev.billisan.alert.dto;

import dev.billisan.inspection.domain.DamageInspection;
import dev.billisan.returns.domain.ReturnAttempt;
import dev.billisan.settlement.domain.Settlement;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** 12-R ALERT-001 응답 계약. */
public record AlertListResponse(List<Item> items) {

    public record Item(
            String alertKey,
            Type type,
            String title,
            String message,
            LocalDateTime occurredAt,
            boolean read,
            Action action
    ) {
        public enum Type {
            RENTAL_DUE_SOON, UNSETTLED, RETURN_COMPLETED, ADMIN_REVIEW, RECOVERY_REQUIRED
        }

        public record Action(ActionType type, UUID targetId) {
            public enum ActionType {
                OPEN_MY_PAGE, OPEN_HISTORY, NONE
            }
        }

        public static Item unsettled(Settlement settlement) {
            long outstanding = Math.max(settlement.getAmount() - settlement.getPaidAmount(), 0);
            return new Item(
                    "UNSETTLED:" + settlement.getSettlementId(),
                    Type.UNSETTLED,
                    "미정산 금액이 있습니다",
                    outstanding + "원이 미납 상태입니다.",
                    settlement.getCreatedAt(),
                    false,
                    new Action(Action.ActionType.OPEN_MY_PAGE, settlement.getSettlementId()));
        }

        public static Item recoveryRequired(ReturnAttempt returnAttempt) {
            return new Item(
                    "RECOVERY_REQUIRED:" + returnAttempt.getReturnAttemptId(),
                    Type.RECOVERY_REQUIRED,
                    "반납 처리 확인이 필요합니다",
                    "반납 처리 중 문제가 발생해 확인이 필요합니다.",
                    returnAttempt.getUpdatedAt(),
                    false,
                    new Action(Action.ActionType.OPEN_HISTORY, returnAttempt.getRentalId()));
        }

        public static Item adminReview(DamageInspection inspection) {
            LocalDateTime occurredAt = inspection.getCompletedAt() != null
                    ? inspection.getCompletedAt()
                    : inspection.getRequestedAt();
            return new Item(
                    "ADMIN_REVIEW:" + inspection.getInspectionId(),
                    Type.ADMIN_REVIEW,
                    "파손 검수 결과를 확인 중입니다",
                    "반납한 우산의 상태를 관리자가 확인하고 있습니다.",
                    occurredAt,
                    false,
                    new Action(Action.ActionType.OPEN_HISTORY, inspection.getRentalId()));
        }
    }
}
