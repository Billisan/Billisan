package dev.billisan.device.dto;

import dev.billisan.slot.domain.Slot.LockStatus;
import dev.billisan.slot.domain.Slot.OccupancyStatus;
import java.time.LocalDateTime;
import java.util.UUID;

public record DeviceTerminalEventRequest(
        UUID eventId,
        String commandId,
        UUID stationId,
        UUID targetDeviceId,
        UUID piBootId,
        UUID orinBootId,
        UUID slotId,
        UUID rentalId,
        UUID returnAttemptId,
        OperationType operationType,
        EventType eventType,
        String resultCode,
        LocalDateTime occurredAt,
        Evidence evidence) {

    public enum OperationType {
        LOCK, UNLOCK
    }

    public enum EventType {
        OPERATION_COMPLETED, OPERATION_FAILED, TIMED_OUT
    }

    public record Evidence(
            int schemaVersion,
            LocalDateTime observedAt,
            PhysicalState before,
            PhysicalState after,
            Stability stability,
            SensorHealth sensorHealth) {

        public record PhysicalState(OccupancyStatus occupancyStatus, LockStatus lockStatus) {
        }

        public record Stability(int windowMillis, int sampleCount) {
        }

        public record SensorHealth(String occupancy, String lock) {
        }
    }
}
