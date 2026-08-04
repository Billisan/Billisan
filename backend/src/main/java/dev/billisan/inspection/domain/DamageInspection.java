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
 * 받지만 저장하지 않는다(API 계약과 실제 스키마 사이 갭, 재확인 필요). EDGE-INSPECT-001부터
 * 검수 결과 생성(쓰기)을 지원한다 — {@code errorCode}·{@code inferenceNode}(요청 페이로드
 * 필드)도 대응 컬럼이 없어 받기만 하고 저장하지 않는다.
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

    private DamageInspection(
            UUID inspectionId,
            UUID returnAttemptId,
            UUID rentalId,
            String requestId,
            ProcessStatus status,
            AiResult aiResult,
            BigDecimal confidence,
            String modelVersion,
            LocalDateTime requestedAt) {
        this.inspectionId = inspectionId;
        this.returnAttemptId = returnAttemptId;
        this.rentalId = rentalId;
        this.requestId = requestId;
        this.requestedAt = requestedAt;
        this.status = status;
        this.aiResult = aiResult;
        this.confidence = confidence;
        this.modelVersion = modelVersion;
        this.completedAt = requestedAt;
        this.createdAt = requestedAt;
        this.updatedAt = requestedAt;
    }

    /**
     * EDGE-INSPECT-001 — Orin이 보고한 검수 결과를 저장한다.
     */
    public static DamageInspection create(
            UUID returnAttemptId,
            UUID rentalId,
            String requestId,
            ProcessStatus status,
            AiResult aiResult,
            BigDecimal confidence,
            String modelVersion) {
        // DB는 DATETIME(6)(마이크로초)인데 now()는 나노초라 안 잘라두면 CAS 값이 어긋난다.
        LocalDateTime now = LocalDateTime.now().truncatedTo(ChronoUnit.MICROS);
        return new DamageInspection(
                UUID.randomUUID(), returnAttemptId, rentalId, requestId, status, aiResult, confidence, modelVersion, now);
    }

    /** result가 NORMAL이 아니면(DAMAGED·UNCERTAIN, 또는 실패로 aiResult가 NULL) 관리자 검토가 필요하다. */
    public boolean requiresReview() {
        return aiResult != AiResult.NORMAL;
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
        // DB는 DATETIME(6)(마이크로초)인데 now()는 나노초라 안 잘라두면 CAS 값이 어긋난다.
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
