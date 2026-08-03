package dev.billisan.device.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * P0-3 Option A(V1 마이그레이션 주석)에 따라 대여·반납 도메인과 독립된 장치
 * Command/Terminal 원장이다. {@code rental_id}·{@code return_attempt_id} 컬럼이 없다 —
 * 업무 객체와의 상관은 Spring 오케스트레이션 문맥과 {@code command_id}로만 유지한다.
 * EDGE-RENT-001에 필요한 컬럼만 매핑했다(장치 결과 수신용 event_id·evidence_* 등은
 * 아직 매핑하지 않음).
 */
@Entity
@Table(name = "device_operation")
public class DeviceOperation {

    @Id
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "operation_id", columnDefinition = "CHAR(36)", updatable = false, nullable = false)
    private UUID operationId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "station_id", columnDefinition = "CHAR(36)", updatable = false, nullable = false)
    private UUID stationId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "slot_id", columnDefinition = "CHAR(36)", updatable = false)
    private UUID slotId;

    /** MQTT·WebSocket 연계 Command 중복 제거 키 — Spring 밖(Kiosk↔Pi WebSocket)에서도
     * 참조되는 값이라 UUID 형식만 강제하지 않고 문자열로 둔다(ERD 기준). */
    @Column(name = "command_id", updatable = false, nullable = false, length = 100)
    private String commandId;

    @Enumerated(EnumType.STRING)
    @Column(name = "operation_type", nullable = false, length = 50)
    private OperationType operationType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private Status status;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected DeviceOperation() {
    }

    private DeviceOperation(
            UUID operationId,
            UUID stationId,
            UUID slotId,
            String commandId,
            OperationType operationType,
            LocalDateTime requestedAt) {
        this.operationId = operationId;
        this.stationId = stationId;
        this.slotId = slotId;
        this.commandId = commandId;
        this.operationType = operationType;
        this.status = Status.REQUESTED;
        this.requestedAt = requestedAt;
        this.createdAt = requestedAt;
        this.updatedAt = requestedAt;
    }

    public static DeviceOperation request(UUID stationId, UUID slotId, OperationType operationType) {
        return new DeviceOperation(
                UUID.randomUUID(), stationId, slotId, UUID.randomUUID().toString(), operationType, LocalDateTime.now());
    }

    public UUID getOperationId() {
        return operationId;
    }

    public UUID getStationId() {
        return stationId;
    }

    public UUID getSlotId() {
        return slotId;
    }

    public String getCommandId() {
        return commandId;
    }

    public OperationType getOperationType() {
        return operationType;
    }

    public Status getStatus() {
        return status;
    }

    public LocalDateTime getRequestedAt() {
        return requestedAt;
    }

    public enum OperationType {
        UNLOCK
    }

    /** V2 마이그레이션의 {@code CK_DEVICE_OPERATION_STATUS}와 동일한 값 집합. */
    public enum Status {
        REQUESTED, ACKED, SUCCEEDED, FAILED, TIMED_OUT, OUTCOME_UNKNOWN
    }
}
