package dev.billisan.rental.domain;

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
 * ⚠️ 관리자 페이지 API가 참조하는 데 필요한 최소 컬럼만 매핑한다. 대여 도메인 전체(원자
 * 슬롯 선정·상태 머신·멱등성)는 이 패키지 범위 밖이며, 실제 스키마(V1/V6 등)엔
 * {@code rental_request_id}·{@code failure_code}·{@code active_user_guard} 등 여기 없는
 * 컬럼이 더 있다 — 이 엔티티는 그 컬럼들에 INSERT하지 않으므로(읽기 전용 참조) 매핑 누락이
 * 문제가 되지 않는다.
 */
@Entity
@Table(name = "rental")
public class Rental {

    @Id
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "rental_id", columnDefinition = "CHAR(36)", updatable = false, nullable = false)
    private UUID rentalId;

    @Column(name = "user_id", columnDefinition = "CHAR(9)", updatable = false, nullable = false)
    private String userId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "checkout_slot_id", columnDefinition = "CHAR(36)", updatable = false, nullable = false)
    private UUID checkoutSlotId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private Status status;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;

    @Column(name = "rented_at")
    private LocalDateTime rentedAt;

    @Column(name = "due_at")
    private LocalDateTime dueAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected Rental() {
    }

    public UUID getRentalId() {
        return rentalId;
    }

    public String getUserId() {
        return userId;
    }

    public UUID getCheckoutSlotId() {
        return checkoutSlotId;
    }

    public Status getStatus() {
        return status;
    }

    public LocalDateTime getRequestedAt() {
        return requestedAt;
    }

    public LocalDateTime getRentedAt() {
        return rentedAt;
    }

    public LocalDateTime getDueAt() {
        return dueAt;
    }

    public LocalDateTime getEndedAt() {
        return endedAt;
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
        REQUESTED, ACTIVE, RETURNING, COMPLETED, LOST, CANCELLED, FAILED
    }
}
