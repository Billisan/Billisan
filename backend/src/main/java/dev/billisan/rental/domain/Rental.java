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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * EDGE-RENT-001부터 대여 생성(REQUESTED) 쓰기를 지원한다. {@code failure_code}는 아직
 * 매핑하지 않았다 — 실패 상태로의 전이는 이 오퍼레이션 범위 밖이라 이 엔티티가 그 컬럼에
 * 쓰지 않으므로 매핑 누락이 문제가 되지 않는다. {@code active_user_guard}·
 * {@code requested_slot_guard}는 DB 생성 컬럼이라 애초에 매핑 대상이 아니다(V2
 * 마이그레이션의 UNIQUE 제약으로 중복 방지).
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

    @Column(name = "rental_request_id", updatable = false, nullable = false, length = 100)
    private String rentalRequestId;

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

    private Rental(UUID rentalId, String userId, UUID checkoutSlotId, String rentalRequestId, LocalDateTime requestedAt) {
        this.rentalId = rentalId;
        this.userId = userId;
        this.checkoutSlotId = checkoutSlotId;
        this.rentalRequestId = rentalRequestId;
        this.status = Status.REQUESTED;
        this.requestedAt = requestedAt;
        this.createdAt = requestedAt;
        this.updatedAt = requestedAt;
    }

    /** EDGE-RENT-001 — 원자 선정된 checkoutSlotId로 새 대여를 REQUESTED 상태로 생성한다. */
    public static Rental request(String userId, UUID checkoutSlotId, String rentalRequestId) {
        return new Rental(UUID.randomUUID(), userId, checkoutSlotId, rentalRequestId, LocalDateTime.now());
    }

    /**
     * EDGE-DEVICE-001 — 물리적 UNLOCK 확인 후 REQUESTED에서 ACTIVE로 전이한다.
     * dueAt은 "빌린 날의 다음 날 14시" 정책으로 고정 계산한다(팀 확정).
     */
    public void activate(LocalDateTime rentedAt) {
        this.status = Status.ACTIVE;
        this.rentedAt = rentedAt;
        this.dueAt = LocalDate.from(rentedAt).plusDays(1).atTime(14, 0);
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

    public String getRentalRequestId() {
        return rentalRequestId;
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
