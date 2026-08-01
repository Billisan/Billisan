package dev.billisan.settlement.domain;

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
 * ⚠️ 최소 구현. 자동 연체료(OVERDUE)·자동 분실(LOSS) 스케줄러는 이 패키지 범위 밖이다.
 * 여기서는 관리자 파손 판정(ADMIN-INSPECTION-003)이 만드는 DAMAGE 정산만 다룬다.
 */
@Entity
@Table(name = "settlement")
public class Settlement {

    public static final long DAMAGE_AMOUNT = 7000L;

    @Id
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "settlement_id", columnDefinition = "CHAR(36)", updatable = false, nullable = false)
    private UUID settlementId;

    @Column(name = "user_id", columnDefinition = "CHAR(9)", updatable = false, nullable = false)
    private String userId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "rental_id", columnDefinition = "CHAR(36)", updatable = false, nullable = false)
    private UUID rentalId;

    /**
     * 실제 스키마(V4__add_damage_settlement_basis.sql)의 {@code CK_SETTLEMENT_DAMAGE_BASIS}가
     * {@code reason='DAMAGE'}이면 이 값이 반드시 NOT NULL, 그 외 reason이면 반드시 NULL이길
     * 요구한다({@code UK_SETTLEMENT_DAMAGE_INSPECTION_ID}로 검수 1건당 정산 1건도 강제). 이
     * 필드가 없으면 DAMAGE 정산 INSERT/UPDATE가 CHECK 제약 위반으로 그대로 거부된다.
     */
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "damage_inspection_id", columnDefinition = "CHAR(36)")
    private UUID damageInspectionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason", nullable = false, length = 20)
    private Reason reason;

    @Column(name = "amount", nullable = false)
    private long amount;

    @Column(name = "paid_amount", nullable = false)
    private long paidAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private Status status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected Settlement() {
    }

    private Settlement(
            UUID settlementId, String userId, UUID rentalId, UUID damageInspectionId, Reason reason, long amount) {
        this.settlementId = settlementId;
        this.userId = userId;
        this.rentalId = rentalId;
        this.damageInspectionId = damageInspectionId;
        this.reason = reason;
        this.amount = amount;
        this.paidAmount = 0L;
        this.status = Status.PENDING;
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public static Settlement createForDamage(String userId, UUID rentalId, UUID damageInspectionId) {
        return new Settlement(UUID.randomUUID(), userId, rentalId, damageInspectionId, Reason.DAMAGE, DAMAGE_AMOUNT);
    }

    /**
     * 기존 정산 행(예: 진행 중이던 OVERDUE)을 파손 사유로 대체한다. 과금 정책 "파손은
     * 연체료와 합산하지 않고 대체" + "DAMAGE &gt; LOSS &gt; OVERDUE 우선순위" — DAMAGE가
     * 최우선이므로 기존 사유가 무엇이든 무조건 대체한다. {@code paidAmount}는 보존한다.
     * {@code damageInspectionId}는 필수로 같이 채운다 — 안 채우면 실제 스키마의
     * {@code CK_SETTLEMENT_DAMAGE_BASIS} 위반으로 UPDATE 자체가 거부된다.
     */
    public void applyDamage(UUID damageInspectionId) {
        this.reason = Reason.DAMAGE;
        this.amount = DAMAGE_AMOUNT;
        this.damageInspectionId = damageInspectionId;
        recomputeStatus();
    }

    /**
     * PAID → PENDING으로 되돌아갈 때 {@code paidAt}을 반드시 같이 지운다. 실제 스키마의
     * {@code TRG_SETTLEMENT_PAYMENT_BEFORE_UPDATE} 트리거는 이미 완납된 정산이 금액 상향으로
     * 다시 PENDING이 되는 걸 {@code allowed_upward_reprice}로 예외 허용하는데, 그 조건에
     * {@code NEW.paid_at IS NULL}이 포함돼 있다 — paidAt을 안 지우면 이 UPDATE가
     * {@code SETTLEMENT_PAYMENT_FIELDS_MANAGED} 오류로 거부된다.
     */
    private void recomputeStatus() {
        if (this.paidAmount >= this.amount) {
            this.status = Status.PAID;
            if (this.paidAt == null) {
                this.paidAt = LocalDateTime.now();
            }
        } else {
            this.status = Status.PENDING;
            this.paidAt = null;
        }
    }

    @PreUpdate
    private void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public UUID getSettlementId() {
        return settlementId;
    }

    public String getUserId() {
        return userId;
    }

    public UUID getRentalId() {
        return rentalId;
    }

    public UUID getDamageInspectionId() {
        return damageInspectionId;
    }

    public Reason getReason() {
        return reason;
    }

    public long getAmount() {
        return amount;
    }

    public long getPaidAmount() {
        return paidAmount;
    }

    public Status getStatus() {
        return status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getPaidAt() {
        return paidAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public enum Reason {
        OVERDUE, LOSS, DAMAGE, ADJUSTMENT
    }

    public enum Status {
        PENDING, PAID, CANCELLED
    }
}
