package dev.billisan.slot.dto;

import dev.billisan.slot.domain.Slot;
import java.time.LocalDateTime;
import java.util.UUID;

public record SlotSummaryResponse(
        UUID slotId,
        int slotNumber,
        String occupancyStatus,
        String itemCondition,
        String serviceStatus,
        String lockStatus,
        LocalDateTime updatedAt
) {
    public static SlotSummaryResponse of(Slot slot) {
        return new SlotSummaryResponse(
                slot.getSlotId(),
                slot.getSlotNumber(),
                slot.getOccupancyStatus().name(),
                slot.getItemCondition() == null ? null : slot.getItemCondition().name(),
                slot.getServiceStatus().name(),
                slot.getLockStatus().name(),
                slot.getUpdatedAt());
    }
}
