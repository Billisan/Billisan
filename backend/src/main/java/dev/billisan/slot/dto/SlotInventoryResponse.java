package dev.billisan.slot.dto;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * ADMIN-INVENTORY-001. ⚠️ 집계 항목은 서로 겹칠 수 있어 단순 합산 금지 — 예:
 * {@code availableUmbrellaCount}와 {@code damagedUmbrellaCount}는 서로 다른 분류 축
 * (가용성 vs 파손 여부)이라 더해서 {@code totalSlotCount}가 나오지 않는다.
 */
public record SlotInventoryResponse(
        UUID stationId,
        long totalSlotCount,
        long occupiedSlotCount,
        long emptySlotCount,
        long unknownOccupancySlotCount,
        long availableUmbrellaCount,
        long adminReviewSlotCount,
        long outOfServiceSlotCount,
        long damagedUmbrellaCount,
        LocalDateTime asOf
) {
}
