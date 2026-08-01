package dev.billisan.slot.dto;

import dev.billisan.slot.domain.Slot.ItemCondition;
import dev.billisan.slot.domain.Slot.ServiceStatus;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

/**
 * ADMIN-SLOT-STATUS-001. {@code occupancyStatus}·관리자 ID·판정 시각은 요청에 없다 —
 * occupancyStatus는 물리 장치 값이라 관리자가 못 바꾸고, 관리자 ID는 인증 세션에서 서버가
 * 채운다.
 *
 * {@code reasonCode}는 Bean Validation이 아니라 서비스 계층에서 직접 검증한다 — 비어있으면
 * 일반 400이 아니라 전용 {@code 422 ADMIN_REASON_REQUIRED}여야 하기 때문이다.
 */
public record SlotStatusUpdateRequest(
        @NotNull ServiceStatus targetServiceStatus,
        @NotNull ItemCondition targetItemCondition,
        String reasonCode,
        String note,
        @AssertTrue(message = "physicalStateConfirmed는 현장 실물을 확인한 뒤에만 true로 보낼 수 있습니다.")
        boolean physicalStateConfirmed,
        @NotNull LocalDateTime expectedUpdatedAt
) {
}
