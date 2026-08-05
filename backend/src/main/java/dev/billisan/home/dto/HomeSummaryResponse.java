package dev.billisan.home.dto;

import dev.billisan.rental.domain.Rental;

import java.time.LocalDateTime;
import java.util.UUID;

/** 12-R HOME-001 응답 계약 — 금액·연체 여부·기한은 App이 재계산하지 않고 이 응답 값을 그대로 쓴다. */
public record HomeSummaryResponse(
        UserSummary user,
        CurrentRental currentRental,
        PendingSettlement pendingSettlement,
        int alertCount
) {
    public record UserSummary(String displayName, String schoolName) {
    }

    public record CurrentRental(
            UUID rentalId,
            Rental.Status status,
            String checkoutStationName,
            LocalDateTime rentedAt,
            LocalDateTime dueAt,
            boolean overdue,
            long remainingFreeSeconds
    ) {
    }

    public record PendingSettlement(int count, long totalAmount) {
    }
}
