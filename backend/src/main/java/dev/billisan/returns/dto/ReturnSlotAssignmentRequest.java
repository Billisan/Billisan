package dev.billisan.returns.dto;

import java.util.UUID;

public record ReturnSlotAssignmentRequest(UUID returnAttemptId, UUID stationId) {
}
