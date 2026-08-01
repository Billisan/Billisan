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
        LocalDateTime updatedAt,
        UUID updatedBy
) {
    /** ADMIN-SLOT-001 목록용 — 이 API 계약엔 updatedBy가 없다. */
    public static SlotSummaryResponse of(Slot slot) {
        return of(slot, null);
    }

    /** ADMIN-SLOT-STATUS-001 PATCH 응답용 — 변경을 수행한 관리자 식별자가 필수다. */
    public static SlotSummaryResponse of(Slot slot, UUID updatedBy) {
        return new SlotSummaryResponse(
                slot.getSlotId(),
                slot.getSlotNumber(),
                slot.getOccupancyStatus().name(),
                slot.getItemCondition() == null ? null : slot.getItemCondition().name(),
                slot.getServiceStatus().name(),
                slot.getLockStatus().name(),
                slot.getUpdatedAt(),
                updatedBy);
    }
}
