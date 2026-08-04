package dev.billisan.inspection.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record InspectionResultResponse(
        UUID inspectionRequestId,
        UUID returnAttemptId,
        String storedResult,
        boolean reviewRequired,
        String slotServiceStatus,
        LocalDateTime updatedAt) {
}
