package dev.billisan.slot.dto;

import java.util.List;
import java.util.UUID;

/** ADMIN-SLOT-001. 관리자 웹은 배열이 아니라 {@code {stationId, items}} 객체를 기대한다. */
public record SlotListResponse(
        UUID stationId,
        List<SlotSummaryResponse> items
) {
}
