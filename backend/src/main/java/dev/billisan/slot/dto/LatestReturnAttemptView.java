package dev.billisan.slot.dto;

import dev.billisan.returns.domain.ReturnAttempt;
import java.time.LocalDateTime;
import java.util.UUID;

public record LatestReturnAttemptView(
        UUID returnAttemptId,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static LatestReturnAttemptView of(ReturnAttempt returnAttempt) {
        return new LatestReturnAttemptView(
                returnAttempt.getReturnAttemptId(),
                returnAttempt.getStatus().name(),
                returnAttempt.getCreatedAt(),
                returnAttempt.getUpdatedAt());
    }
}
