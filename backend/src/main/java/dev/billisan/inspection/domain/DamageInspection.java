package dev.billisan.inspection.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * 실제 Flyway 마이그레이션(V1/V7/V14)의 {@code damage_inspection} 컬럼 구성을 그대로
 * 따른다. "관리자가 판정했는지"는 별도 컬럼이 아니라 {@code reviewed_by IS NULL} 여부로
 * 판단한다({@link #isReviewed()}). {@code slot_id}는 직접 저장하지 않는다 —
 * {@code return_attempt_id} → {@code return_attempt.return_slot_id}로 간접 조회한다
 * ({@link dev.billisan.inspection.service.InspectionAdminService} 참조).
 * {@code decision_reason_code}/{@code decision_note}(관리자 API 계약이 응답 필드로
 * 문서화한 값)는 실제 스키마에 대응 컬럼이 없어 이 엔티티엔 두지 않는다 — API 요청은
 * 받지만 저장하지 않는다(API 계약과 실제 스키마 사이 갭, 재확인 필요).
 */
@Entity
@Table(name = "damage_inspection")
public class DamageInspection {

    @Id
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "inspection_id", columnDefinition = "CHAR(36)", updatable = false, nullable = false)
    private UUID inspectionId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "return_attempt_id", columnDefinition = "CHAR(36)", updatable = false, nullable = false)
    private UUID returnAttemptId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "rental_id", columnDefinition = "CHAR(36)", updatable = false, nullable = false)
    private UUID rentalId;

    @Column(name = "request_id", updatable = false, nullable = false, length = 100)
    private String requestId;

    @Column(name = "requested_at", updatable = false, nullable = false)
    private LocalDateTime requestedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private ProcessStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "ai_result", length = 50)
    private AiResult aiResult;

    @Column(name = "confidence", precision = 5, scale = 4)
    private BigDecimal confidence;

    @Column(name = "model_version", length = 100)
    private String modelVersion;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "admin_decision", length = 50)
    private Decision adminDecision;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "reviewed_by", columnDefinition = "CHAR(36)")
    private UUID reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected DamageInspection() {
    }

    /**
     * ADMIN-INSPECTION-003(NORMAL|DAMAGED) 전용. 호출 전 {@link #isReviewed()}로 "이미
     * 확정된 검수는 다시 판정할 수 없다"를 서비스 계층이 먼저 확인할 것 — 이 메서드 자체는
     * 검증하지 않는다({@code Slot.applyAdminStatus}와 같은 원칙).
     */
    public void review(Decision decision, UUID reviewedBy) {
        this.adminDecision = decision;
        this.reviewedBy = reviewedBy;
        this.reviewedAt = LocalDateTime.now().truncatedTo(ChronoUnit.MICROS);
    }

    public boolean isReviewed() {
        return reviewedBy != null;
    }

    /** DB 컬럼이 아니라 {@link #isReviewed()}로 계산되는 조회·필터용 그룹. */
    public ReviewStatus reviewStatus() {
        return isReviewed() ? ReviewStatus.DECIDED : ReviewStatus.PENDING;
    }

    @PreUpdate
    private void onUpdate() {
        // MySQL DATETIME(6)은 마이크로초까지만 저장하는데 LocalDateTime.now()는 나노초
        // 단위라, 안 잘라두면 PATCH 응답의 updatedAt(메모리 값)과 DB 반영값이 반올림으로
        // 어긋난다 — 그 값을 재조회 없이 다음 PATCH의 expectedUpdatedAt으로 그대로
        // 체이닝하면 실제로는 최신인데도 CONCURRENT_MODIFICATION이 잘못 뜬다(실기 테스트로
        // 발견, Slot과 동일 원인).
        this.updatedAt = LocalDateTime.now().truncatedTo(ChronoUnit.MICROS);
    }

    public UUID getInspectionId() {
        return inspectionId;
    }

    public UUID getReturnAttemptId() {
        return returnAttemptId;
    }

    public UUID getRentalId() {
        return rentalId;
    }

    public String getRequestId() {
        return requestId;
    }

    public LocalDateTime getRequestedAt() {
        return requestedAt;
    }

    public ProcessStatus getStatus() {
        return status;
    }

    public AiResult getAiResult() {
        return aiResult;
    }

    public BigDecimal getConfidence() {
        return confidence;
    }

    public String getModelVersion() {
        return modelVersion;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public Decision getAdminDecision() {
        return adminDecision;
    }

    public UUID getReviewedBy() {
        return reviewedBy;
    }

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    /** AI 파이프라인 진행 상태(요청/완료/실패) — 관리자 판정 여부와는 별개다. */
    public enum ProcessStatus {
        REQUESTED, COMPLETED, FAILED
    }

    /** FAILED는 값이 아니라 {@code ai_result IS NULL}로 표현한다. */
    public enum AiResult {
        NORMAL, DAMAGED, UNCERTAIN
    }

    /** DB 컬럼이 아니라 {@code reviewed_by} 유무로 계산되는 조회·필터 전용 그룹. */
    public enum ReviewStatus {
        PENDING, DECIDED
    }

    public enum Decision {
        NORMAL, DAMAGED
    }
}
