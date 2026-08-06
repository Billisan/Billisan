package dev.billisan.returns.dto;

import java.util.UUID;

public record ReturnAttemptResponse(
        UUID returnAttemptId, UUID rentalId, String status, String userId, String name, UUID returnSlotId) {
}
