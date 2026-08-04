package dev.billisan.device.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record DeviceTerminalEventResponse(
        UUID eventId,
        String commandId,
        String deviceOperationStatus,
        String domainStatus,
        String reconciliationStatus,
        LocalDateTime updatedAt) {
}
