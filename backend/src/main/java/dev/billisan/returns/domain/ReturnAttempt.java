package dev.billisan.returns.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * EDGE-RETURN-001부터 반납 시도 생성(PROCESSING) 쓰기를, EDGE-DEVICE-001 반납 경로부터
 * PHYSICAL_DONE/COMPLETED/RECOVERY_REQUIRED 전이 쓰기를 지원한다. {@code failure_reason}은
 * 아직 매핑하지 않았다 — FAILED로의 전이는 이 오퍼레이션들 범위 밖이라 이 엔티티가 그
 * 컬럼에 쓰지 않으므로 매핑 누락이 문제가 되지 않는다. 패키지명이 {@code return}이 아니라
 * {@code returns}인 이유는 {@code return}이 Java 예약어라서다.
 */
@Entity
@Table(name = "return_attempt")
public class ReturnAttempt {

    @Id
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "return_attempt_id", columnDefinition = "CHAR(36)", updatable = false, nullable = false)
    private UUID returnAttemptId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "rental_id", columnDefinition = "CHAR(36)", updatable = false, nullable = false)
    private UUID rentalId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "return_slot_id", columnDefinition = "CHAR(36)")
    private UUID returnSlotId;

    @Column(name = "request_id", updatable = false, nullable = false, length = 100)
    private String requestId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private Status status;

    @Column(name = "physical_completed_at")
    private LocalDateTime physicalCompletedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected ReturnAttempt() {
    }

    private ReturnAttempt(UUID returnAttemptId, UUID rentalId, String requestId, LocalDateTime createdAt) {
        this.returnAttemptId = returnAttemptId;
        this.rentalId = rentalId;
        this.requestId = requestId;
        this.status = Status.PROCESSING;
        this.createdAt = createdAt;
        this.updatedAt = createdAt;
    }

    /** EDGE-RETURN-001 — SLOT 미선정 상태로 새 반납 시도를 PROCESSING 상태로 생성한다. */
    public static ReturnAttempt create(UUID rentalId, String requestId) {
        return new ReturnAttempt(UUID.randomUUID(), rentalId, requestId, LocalDateTime.now());
    }

    /** EDGE-RETURN-003 — 원자 선정된 SLOT을 반납 시도에 배정한다. */
    public void assignReturnSlot(UUID returnSlotId) {
        this.returnSlotId = returnSlotId;
    }

    /** EDGE-DEVICE-001 — 물리적 LOCK 확인 후 PROCESSING에서 PHYSICAL_DONE으로 전이한다. */
    public void markPhysicalDone(LocalDateTime physicalCompletedAt) {
        this.status = Status.PHYSICAL_DONE;
        this.physicalCompletedAt = physicalCompletedAt;
    }

    /** EDGE-DEVICE-001 — 검수 결과가 NORMAL이면 PHYSICAL_DONE에서 COMPLETED로 전이한다. */
    public void complete(LocalDateTime completedAt) {
        this.status = Status.COMPLETED;
        this.completedAt = completedAt;
    }

    /**
     * EDGE-DEVICE-001 — 검수 결과가 파손 의심(NORMAL 아님)이거나 아직 검수가 도착하지
     * 않았으면 PHYSICAL_DONE에서 RECOVERY_REQUIRED로 전이해 관리자 개입을 기다린다.
     */
    public void requireRecovery() {
        this.status = Status.RECOVERY_REQUIRED;
    }

    public UUID getReturnAttemptId() {
        return returnAttemptId;
    }

    public UUID getRentalId() {
        return rentalId;
    }

    public UUID getReturnSlotId() {
        return returnSlotId;
    }

    public String getRequestId() {
        return requestId;
    }

    public Status getStatus() {
        return status;
    }

    public LocalDateTime getPhysicalCompletedAt() {
        return physicalCompletedAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    @PreUpdate
    private void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public enum Status {
        PROCESSING, PHYSICAL_DONE, COMPLETED, RECOVERY_REQUIRED, FAILED
    }
}
