package dev.billisan.rental.dto;

import dev.billisan.rental.domain.Rental;
import dev.billisan.returns.domain.ReturnAttempt;
import dev.billisan.slot.domain.Slot;
import dev.billisan.station.domain.Station;

import java.time.LocalDateTime;
import java.util.UUID;

/** 12-R RENTAL-001 응답 계약. */
public record RentalCurrentResponse(
        UUID rentalId,
        Rental.Status status,
        UUID checkoutSlotId,
        int checkoutSlotNumber,
        CheckoutStation checkoutStation,
        LocalDateTime rentedAt,
        LocalDateTime dueAt,
        int overdueDays,
        long calculatedOverdueAmount,
        LatestReturnAttempt latestReturnAttempt,
        String failureCode,
        LocalDateTime failedAt
) {
    public static RentalCurrentResponse of(
            Rental rental,
            Slot checkoutSlot,
            Station checkoutStation,
            ReturnAttempt latestReturnAttempt,
            Slot returnSlot,
            int overdueDays,
            long calculatedOverdueAmount) {
        return new RentalCurrentResponse(
                rental.getRentalId(),
                rental.getStatus(),
                checkoutSlot.getSlotId(),
                checkoutSlot.getSlotNumber(),
                new CheckoutStation(checkoutStation.getStationId(), checkoutStation.getName()),
                rental.getRentedAt(),
                rental.getDueAt(),
                overdueDays,
                calculatedOverdueAmount,
                latestReturnAttempt == null ? null : LatestReturnAttempt.of(latestReturnAttempt, returnSlot),
                rental.getFailureCode(),
                rental.getFailedAt());
    }

    public record CheckoutStation(UUID stationId, String name) {
    }

    public record LatestReturnAttempt(
            UUID returnAttemptId, ReturnAttempt.Status status, UUID returnSlotId, Integer returnSlotNumber) {

        static LatestReturnAttempt of(ReturnAttempt attempt, Slot returnSlot) {
            return new LatestReturnAttempt(
                    attempt.getReturnAttemptId(),
                    attempt.getStatus(),
                    attempt.getReturnSlotId(),
                    returnSlot == null ? null : returnSlot.getSlotNumber());
        }
    }
}
