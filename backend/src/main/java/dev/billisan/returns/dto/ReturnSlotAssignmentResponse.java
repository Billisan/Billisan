package dev.billisan.returns.dto;

import java.util.UUID;

public record ReturnSlotAssignmentResponse(
        UUID returnAttemptId,
        UUID returnSlotId,
        int slotNumber,
        DeviceOperationView deviceOperation) {

    public record DeviceOperationView(String commandId, String operationType, String status) {
    }
}
