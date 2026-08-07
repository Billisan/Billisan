package dev.billisan.device.dto;

import dev.billisan.slot.domain.Slot.LockStatus;
import dev.billisan.slot.domain.Slot.OccupancyStatus;
import java.time.Instant;
import java.util.UUID;

/**
 * {@code occurredAt}·{@code evidence.observedAt}는 장치가 보고하는 절대 사건 시각이라
 * {@link Instant}로 받는다 — {@code LocalDateTime}으로 받으면 Jackson이 오프셋(예: {@code Z})을
 * 그냥 버리고 숫자만 그대로 읽어, 실제로는 UTC로 보낸 시각을 KST로 잘못 해석하는 버그가
 * 있었다(EC2 실측: {@code CK_DEVICE_OPERATION_LIFECYCLE_TIME_ORDER} 위반, {@code setTimeZone}
 * 설정은 LocalDateTime엔 적용되지 않는다는 것도 직접 확인함). DB(DATETIME, 무존)에 넣을 땐
 * {@link dev.billisan.device.service.DeviceTerminalEventService}가 Asia/Seoul로 명시
 * 변환한다.
 */
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
        Instant occurredAt,
        Evidence evidence) {

    public enum OperationType {
        LOCK, UNLOCK
    }

    public enum EventType {
        OPERATION_COMPLETED, OPERATION_FAILED, TIMED_OUT,
        /**
         * 체크아웃 UNLOCK이 끝난 뒤, 백엔드가 명령을 낸 적 없이 Pi가 재잠금을 스스로
         * 감지해 보내는 재확인 이벤트. commandId로 찾을 기존 DeviceOperation이 없으므로
         * slotId 기준으로 처리한다.
         */
        PHYSICAL_STATE_CONFIRMED
    }

    public record Evidence(
            int schemaVersion,
            Instant observedAt,
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
