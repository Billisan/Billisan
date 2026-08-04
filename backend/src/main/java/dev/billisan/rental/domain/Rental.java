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
import java.time.temporal.ChronoUnit;
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
     * dueAt은 "대여 시각을 다음 정시로 올림 + 1일" 정책으로 계산한다(팀 확정)
     * 정확히 정시에 대여해도 항상 다음 시간으로 올린다 — 24시간 후 같은 분 단위 만료를 쓰면
     * 반납 기한이 매분 다르게 흩어져 배치·스케줄러가 분 단위로 돌아야 하는데,
     * 이렇게 정시로만 만료가 몰리게 하면 시간 단위 스케줄러로도 충분하다.
     */
    public void activate(LocalDateTime rentedAt) {
        this.status = Status.ACTIVE;
        this.rentedAt = rentedAt;
        this.dueAt = rentedAt.truncatedTo(ChronoUnit.HOURS).plusHours(1).plusDays(1);
    }

    /** EDGE-RETURN-001 — 반납 시도 생성 시 ACTIVE에서 RETURNING으로 전이한다. */
    public void returning() {
        this.status = Status.RETURNING;
    }

    /** EDGE-DEVICE-001 — 반납 완료(검수 NORMAL) 시 RETURNING에서 COMPLETED로 전이한다. */
    public void complete(LocalDateTime endedAt) {
        this.status = Status.COMPLETED;
        this.endedAt = endedAt;
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
