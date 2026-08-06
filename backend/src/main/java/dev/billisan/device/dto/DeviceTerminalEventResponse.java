package dev.billisan.device.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record DeviceTerminalEventResponse(
        UUID eventId,
        String commandId,
        String deviceOperationStatus,
        String domainStatus,
        String reconciliationStatus,
        LocalDateTime updatedAt,
        Inventory inventory) {

    /**
     * EDGE-DEVICE-001 응답에 실린 대여소 재고 스냅샷 — 해당 트랜잭션 커밋 직후의 값이다.
     * 필드명은 12-I KSK-STATION-001 {@code inventory} 객체와 동일하게 맞춰, 같은 의미의
     * 수치가 두 곳에서 다른 이름으로 쓰이지 않도록 한다.
     */
    public record Inventory(int rentableSlotCount, int emptyReturnSlotCount, int totalSlotCount) {
    }
}
