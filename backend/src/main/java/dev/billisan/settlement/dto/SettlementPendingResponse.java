package dev.billisan.settlement.dto;

import dev.billisan.settlement.domain.Settlement;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** 12-R SETTLEMENT-001 응답 계약. */
public record SettlementPendingResponse(List<Item> items, long totalOutstandingAmount, boolean rentalEligibilityBlocked) {

    public record Item(
            UUID settlementId,
            UUID rentalId,
            Settlement.Reason reason,
            long amount,
            long paidAmount,
            long outstandingAmount,
            Settlement.Status status,
            String description,
            LocalDateTime createdAt
    ) {
        public static Item of(Settlement settlement) {
            long outstanding = Math.max(settlement.getAmount() - settlement.getPaidAmount(), 0);
            return new Item(
                    settlement.getSettlementId(),
                    settlement.getRentalId(),
                    settlement.getReason(),
                    settlement.getAmount(),
                    settlement.getPaidAmount(),
                    outstanding,
                    settlement.getStatus(),
                    description(settlement.getReason()),
                    settlement.getCreatedAt());
        }

        private static String description(Settlement.Reason reason) {
            return switch (reason) {
                case OVERDUE -> "연체료";
                case LOSS -> "분실 보상금";
                case DAMAGE -> "파손 보상금";
                case ADJUSTMENT -> "정산 조정";
            };
        }
    }
}
