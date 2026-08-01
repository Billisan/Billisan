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
 * ⚠️ 관리자 페이지 API가 읽기 전용으로 참조하는 데 필요한 컬럼만 매핑한다. 패키지명이
 * {@code return}이 아니라 {@code returns}인 이유는 {@code return}이 Java 예약어라서다.
 * 실제 스키마엔 {@code request_id}·{@code physical_completed_at}·{@code completed_at}
 * 등 여기 없는 컬럼이 더 있다 — 이 엔티티는 반납 시도를 새로 만들지 않으므로(대여/반납
 * 상태 머신은 이 패키지 범위 밖) 매핑 누락이 문제가 되지 않는다.
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

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private Status status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected ReturnAttempt() {
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

    public Status getStatus() {
        return status;
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
