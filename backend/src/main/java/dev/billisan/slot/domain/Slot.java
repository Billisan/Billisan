package dev.billisan.slot.domain;

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

@Entity
@Table(name = "slot")
public class Slot {

    @Id
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "slot_id", columnDefinition = "CHAR(36)", updatable = false, nullable = false)
    private UUID slotId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "station_id", columnDefinition = "CHAR(36)", updatable = false, nullable = false)
    private UUID stationId;

    @Column(name = "slot_number", nullable = false)
    private int slotNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "service_status", nullable = false, length = 30)
    private ServiceStatus serviceStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "occupancy_status", nullable = false, length = 30)
    private OccupancyStatus occupancyStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "lock_status", nullable = false, length = 30)
    private LockStatus lockStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_condition", length = 30)
    private ItemCondition itemCondition;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected Slot() {
    }

    private Slot(
            UUID slotId,
            UUID stationId,
            int slotNumber,
            ServiceStatus serviceStatus,
            OccupancyStatus occupancyStatus,
            LockStatus lockStatus,
            ItemCondition itemCondition) {
        this.slotId = slotId;
        this.stationId = stationId;
        this.slotNumber = slotNumber;
        this.serviceStatus = serviceStatus;
        this.occupancyStatus = occupancyStatus;
        this.lockStatus = lockStatus;
        this.itemCondition = itemCondition;
        // MySQL DATETIME(6)은 마이크로초까지만 저장하는데 LocalDateTime.now()는 나노초
        // 단위라, 안 잘라두면 응답의 updatedAt(메모리 값)과 DB에 반영된 값이 반올림으로
        // 어긋난다 — 이 값을 그대로 다음 PATCH의 expectedUpdatedAt으로 재사용하면(재조회
        // 없이 응답 체이닝) 실제로는 최신인데도 SLOT_STATUS_CONFLICT가 잘못 뜬다(실기
        // 테스트로 발견).
        LocalDateTime now = LocalDateTime.now().truncatedTo(ChronoUnit.MICROS);
        this.createdAt = now;
        this.updatedAt = now;
    }

    public static Slot create(
            UUID stationId,
            int slotNumber,
            ServiceStatus serviceStatus,
            OccupancyStatus occupancyStatus,
            LockStatus lockStatus,
            ItemCondition itemCondition) {
        return new Slot(UUID.randomUUID(), stationId, slotNumber, serviceStatus, occupancyStatus, lockStatus, itemCondition);
    }

    /**
     * 관리자 수동 판정(ADMIN-SLOT-STATUS-001) 및 검수 판정(ADMIN-INSPECTION-003) 결과 반영
     * 공용 진입점. occupancyStatus·lockStatus는 이 메서드로 바꾸지 않는다 — 물리 장치가
     * 보고하는 값이라 관리자 API 범위 밖(docs/API-draft.md §8.2). 호출 전 반드시
     * {@link #isValidAdminCombination}으로 검증할 것 — 이 메서드 자체는 검증하지 않는다.
     */
    public void applyAdminStatus(ServiceStatus targetServiceStatus, ItemCondition targetItemCondition) {
        this.serviceStatus = targetServiceStatus;
        this.itemCondition = targetItemCondition;
    }

    /**
     * ADMIN-SLOT-STATUS-001이 허용하는 조합만 유효하다(docs/API-draft.md §8.2):
     * {@code AVAILABLE+(EMPTY|NORMAL)}, {@code ADMIN_REVIEW+(UNKNOWN|DAMAGED|REPAIRABLE)},
     * {@code OUT_OF_SERVICE+(DAMAGED|REPAIRABLE|EMPTY)}.
     */
    public static boolean isValidAdminCombination(ServiceStatus serviceStatus, ItemCondition itemCondition) {
        return switch (serviceStatus) {
            case AVAILABLE -> itemCondition == ItemCondition.EMPTY || itemCondition == ItemCondition.NORMAL;
            case ADMIN_REVIEW -> itemCondition == ItemCondition.UNKNOWN
                    || itemCondition == ItemCondition.DAMAGED
                    || itemCondition == ItemCondition.REPAIRABLE;
            case OUT_OF_SERVICE -> itemCondition == ItemCondition.DAMAGED
                    || itemCondition == ItemCondition.REPAIRABLE
                    || itemCondition == ItemCondition.EMPTY;
        };
    }

    @PreUpdate
    private void onUpdate() {
        this.updatedAt = LocalDateTime.now().truncatedTo(ChronoUnit.MICROS);
    }

    public UUID getSlotId() {
        return slotId;
    }

    public UUID getStationId() {
        return stationId;
    }

    public int getSlotNumber() {
        return slotNumber;
    }

    public ServiceStatus getServiceStatus() {
        return serviceStatus;
    }

    public OccupancyStatus getOccupancyStatus() {
        return occupancyStatus;
    }

    public LockStatus getLockStatus() {
        return lockStatus;
    }

    public ItemCondition getItemCondition() {
        return itemCondition;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    /** v3.0 ERD(08) 기준 — v1.0/v2.0의 RENTING/RETURNING/MAINTENANCE/ERROR는 더 이상 안 씀. */
    public enum ServiceStatus {
        AVAILABLE, ADMIN_REVIEW, OUT_OF_SERVICE
    }

    public enum OccupancyStatus {
        EMPTY, OCCUPIED, UNKNOWN
    }

    public enum LockStatus {
        LOCKED, UNLOCKED, UNKNOWN, ERROR
    }

    /** v3.0 ERD(08) 기준 — REVIEW_REQUIRED 대신 REPAIRABLE. */
    public enum ItemCondition {
        EMPTY, NORMAL, DAMAGED, REPAIRABLE, UNKNOWN
    }
}
