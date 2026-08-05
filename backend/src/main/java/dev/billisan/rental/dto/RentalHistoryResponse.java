package dev.billisan.rental.dto;

import dev.billisan.rental.domain.Rental;
import dev.billisan.settlement.domain.Settlement;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** 12-R RENTAL-002 응답 계약. */
public record RentalHistoryResponse(List<Item> items, String nextCursor) {

    public record Item(
            UUID rentalId,
            Rental.Status status,
            String checkoutStationName,
            String returnStationName,
            LocalDateTime rentedAt,
            LocalDateTime endedAt,
            LocalDateTime dueAt,
            long settlementAmount,
            Settlement.Status settlementStatus,
            String failureCode,
            LocalDateTime failedAt
    ) {
        public static Item of(Rental rental, String checkoutStationName, String returnStationName, Settlement settlement) {
            return new Item(
                    rental.getRentalId(),
                    rental.getStatus(),
                    checkoutStationName,
                    returnStationName,
                    rental.getRentedAt(),
                    rental.getEndedAt(),
                    rental.getDueAt(),
                    settlement == null ? 0L : settlement.getAmount(),
                    settlement == null ? null : settlement.getStatus(),
                    rental.getFailureCode(),
                    rental.getFailedAt());
        }
    }
}
