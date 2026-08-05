package dev.billisan.device.domain;

import dev.billisan.slot.domain.Slot.LockStatus;
import dev.billisan.slot.domain.Slot.OccupancyStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * P0-3 Option A(V1 마이그레이션 주석)에 따라 대여·반납 도메인과 독립된 장치
 * Command/Terminal 원장이다. {@code rental_id}·{@code return_attempt_id} 컬럼이 없다 —
 * 업무 객체와의 상관은 Spring 오케스트레이션 문맥과 {@code command_id}로만 유지한다.
 * EDGE-DEVICE-001은 commandId로 이 엔티티를 조회해 이미 종결(SUCCEEDED/FAILED/
 * TIMED_OUT/OUTCOME_UNKNOWN) 상태인지부터 확인한다(리뷰로 발견) — Rental.status만으로
 * 재처리 여부를 판단하면, 실패 시 Rental이 그대로 REQUESTED에 남아있어서 뒤늦게 도착한
 * 성공 이벤트가 이미 실패 처리된 명령을 다시 성공으로 뒤집어버릴 수 있었다.
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

    /** EDGE-DEVICE-001이 채우는 장치 이벤트 멱등 키. 최초 REQUESTED 시점엔 없다. */
    @Column(name = "event_id", length = 100)
    private String eventId;

    @Enumerated(EnumType.STRING)
    @Column(name = "operation_type", nullable = false, length = 50)
    private OperationType operationType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private Status status;

    /**
     * DB의 CK_DEVICE_OPERATION_TERMINAL_EVENT_TYPE은 OPERATION_COMPLETED·
     * OPERATION_FAILED 2개만 허용한다 — 요청의 eventType엔 TIMED_OUT도 있지만,
     * 그 경우 이 컬럼은 NULL로 두고 status만 TIMED_OUT으로 기록한다.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "terminal_event_type", length = 50)
    private TerminalEventType terminalEventType;

    @Column(name = "result_code", length = 100)
    private String resultCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "observed_occupancy_status", length = 30)
    private OccupancyStatus observedOccupancyStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "observed_lock_status", length = 30)
    private LockStatus observedLockStatus;

    @Column(name = "evidence_schema_version")
    private Short evidenceSchemaVersion;

    @Column(name = "evidence_observed_at")
    private LocalDateTime evidenceObservedAt;

    /** 증거 원문(JSON) — evidence 객체 전체를 그대로 직렬화해 저장한다. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "evidence_payload")
    private String evidencePayload;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;

    @Column(name = "acked_at")
    private LocalDateTime ackedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

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

    /**
     * 장치(Pi)가 보고하는 evidence.observedAt은 초 단위까지만 온다(소수점 없음) — requestedAt을
     * 그대로 마이크로초로 두면, 명령 발행부터 물리 반응까지 1초 미만으로 끝났을 때 초 단위로
     * 잘린 observedAt이 숫자상 더 이르게 보여 CK_DEVICE_OPERATION_LIFECYCLE_TIME_ORDER를
     * 위반할 수 있다(EC2 실측 확인). withNano(0)로 같은 정밀도(초 단위)로 맞추면 이 비교가
     * 항상 안전하다 — 버림은 순서를 보존하는 연산이라 별도의 보정치가 필요 없다.
     */
    public static DeviceOperation request(UUID stationId, UUID slotId, OperationType operationType) {
        return new DeviceOperation(
                UUID.randomUUID(), stationId, slotId, UUID.randomUUID().toString(), operationType,
                LocalDateTime.now().withNano(0));
    }

    public boolean isTerminal() {
        return status == Status.SUCCEEDED
                || status == Status.FAILED
                || status == Status.TIMED_OUT
                || status == Status.OUTCOME_UNKNOWN;
    }

    /**
     * EDGE-DEVICE-001 — Pi가 보고한 Terminal 이벤트를 기록한다. terminalEventType은
     * TIMED_OUT일 때 null을 넘긴다(DB CHECK가 OPERATION_COMPLETED·OPERATION_FAILED만
     * 허용).
     */
    public void recordTerminalOutcome(
            Status status,
            TerminalEventType terminalEventType,
            String eventId,
            String resultCode,
            OccupancyStatus observedOccupancyStatus,
            LockStatus observedLockStatus,
            Short evidenceSchemaVersion,
            LocalDateTime evidenceObservedAt,
            String evidencePayload,
            LocalDateTime completedAt) {
        this.status = status;
        this.terminalEventType = terminalEventType;
        this.eventId = eventId;
        this.resultCode = resultCode;
        this.observedOccupancyStatus = observedOccupancyStatus;
        this.observedLockStatus = observedLockStatus;
        this.evidenceSchemaVersion = evidenceSchemaVersion;
        this.evidenceObservedAt = evidenceObservedAt;
        this.evidencePayload = evidencePayload;
        this.completedAt = completedAt;
    }

    @PreUpdate
    private void onUpdate() {
        this.updatedAt = LocalDateTime.now();
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

    public String getEventId() {
        return eventId;
    }

    public OperationType getOperationType() {
        return operationType;
    }

    public Status getStatus() {
        return status;
    }

    public TerminalEventType getTerminalEventType() {
        return terminalEventType;
    }

    public String getResultCode() {
        return resultCode;
    }

    public OccupancyStatus getObservedOccupancyStatus() {
        return observedOccupancyStatus;
    }

    public LockStatus getObservedLockStatus() {
        return observedLockStatus;
    }

    public Short getEvidenceSchemaVersion() {
        return evidenceSchemaVersion;
    }

    public LocalDateTime getEvidenceObservedAt() {
        return evidenceObservedAt;
    }

    public String getEvidencePayload() {
        return evidencePayload;
    }

    public LocalDateTime getRequestedAt() {
        return requestedAt;
    }

    public LocalDateTime getAckedAt() {
        return ackedAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public enum OperationType {
        UNLOCK
    }

    /** V2 마이그레이션의 {@code CK_DEVICE_OPERATION_STATUS}와 동일한 값 집합. */
    public enum Status {
        REQUESTED, ACKED, SUCCEEDED, FAILED, TIMED_OUT, OUTCOME_UNKNOWN
    }

    /** V2 마이그레이션의 {@code CK_DEVICE_OPERATION_TERMINAL_EVENT_TYPE}과 동일한 값 집합. */
    public enum TerminalEventType {
        OPERATION_COMPLETED, OPERATION_FAILED
    }
}
