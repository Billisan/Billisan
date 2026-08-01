package dev.billisan.slot.dto;

import dev.billisan.slot.domain.Slot;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * ⚠️ {@code updatedBy}는 관리자 웹이 "최근 관리자 변경자"로 기대하는 필드지만, 실제 스키마
 * (Flyway V1~V18) {@code slot} 테이블엔 이 값을 저장할 컬럼이 없다 — 지금은 항상
 * {@code null}이다. 저장하려면 팀에 컬럼 추가를 먼저 요청해야 한다.
 */
public record SlotDetailResponse(
        UUID slotId,
        UUID stationId,
        int slotNumber,
        String occupancyStatus,
        String itemCondition,
        String serviceStatus,
        String lockStatus,
        LocalDateTime updatedAt,
        LatestReturnAttemptView latestReturnAttempt,
        LatestInspectionView latestInspection,
        UUID updatedBy
) {
    public static SlotDetailResponse of(
            Slot slot,
            LatestReturnAttemptView latestReturnAttempt,
            LatestInspectionView latestInspection) {
        return new SlotDetailResponse(
                slot.getSlotId(),
                slot.getStationId(),
                slot.getSlotNumber(),
                slot.getOccupancyStatus().name(),
                slot.getItemCondition() == null ? null : slot.getItemCondition().name(),
                slot.getServiceStatus().name(),
                slot.getLockStatus().name(),
                slot.getUpdatedAt(),
                latestReturnAttempt,
                latestInspection,
                null);
    }
}
