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
        // DB는 DATETIME(6)(마이크로초)인데 now()는 나노초라 안 잘라두면 CAS 값이 어긋난다.
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
     * EDGE-DEVICE-001 — 장치 Terminal 이벤트의 evidence.after 값으로 물리 상태를
     * 갱신한다. {@link #applyAdminStatus}와 분리된 이유는 그쪽과 반대로, 이 메서드는
     * occupancy·lock만 바꾸고 serviceStatus는 건드리지 않기 때문이다 — 물리 센서가
     * 실제로 관측한 값이라 관리자 판단 범위 밖.
     *
     * itemCondition은 예외적으로 observedOccupancyStatus가 EMPTY일 때만 같이 EMPTY로
     * 맞춘다 — "슬롯이 비었다"는 occupancy 센서가 이미 관측한 사실 그 자체라 별도 AI·관리자
     * 판단이 필요 없다(EC2 실측: 체크아웃 후 occupancy만 EMPTY로 바뀌고 itemCondition은
     * 이전 값 그대로 남아 재고 표시가 어긋나는 문제를 재현·확인함). OCCUPIED로 바뀌는
     * 경우(반납)는 실제 물건 상태를 AI/관리자가 아직 판단하기 전이라 여기서 건드리지
     * 않는다 — {@link #confirmNormalItemCondition}·{@link #isolateForReview}의 몫이다.
     */
    public void applyObservedPhysicalState(OccupancyStatus observedOccupancyStatus, LockStatus observedLockStatus) {
        this.occupancyStatus = observedOccupancyStatus;
        this.lockStatus = observedLockStatus;
        if (observedOccupancyStatus == OccupancyStatus.EMPTY) {
            this.itemCondition = ItemCondition.EMPTY;
        }
    }

    /**
     * EDGE-INSPECT-001 결과가 NORMAL이라 반납이 관리자 검토 없이 자동 완료될 때 호출한다.
     * 검수 대상이던 물건이 정상임을 슬롯에 반영한다. serviceStatus는 이 경로에서 이미
     * AVAILABLE이므로 건드리지 않는다(EC2 실측: 이 호출이 없으면 반납 완료 후에도
     * itemCondition이 반납 전 값에 머물러 있었음 — 반납 전 값이 우연히 EMPTY였던 슬롯은
     * "점유중인데 빈 슬롯"으로 표시됨을 확인).
     */
    public void confirmNormalItemCondition() {
        this.itemCondition = ItemCondition.NORMAL;
    }

    /**
     * EDGE-DEVICE-001 — Pi가 장치 Terminal 이벤트를 OPERATION_FAILED·TIMED_OUT으로
     * 보고했을 때 슬롯을 대여 후보에서 빼고 관리자 확인 대상으로 돌린다. occupancy·lock은
     * 실제로 어떻게 됐는지 알 수 없는 상태라 건드리지 않는다. 판정 근거가 없는 호출부는
     * 이 기본값(UNKNOWN)을 쓴다.
     */
    public void isolateForReview() {
        isolateForReview(ItemCondition.UNKNOWN);
    }

    /**
     * EDGE-INSPECT-001 결과가 관리자 검토를 요구할 때(DAMAGED·UNCERTAIN·FAILED) 슬롯을
     * 격리한다. AI가 DAMAGED로 명확히 판정한 경우엔 UNKNOWN보다 구체적인 정보를 관리자에게
     * 바로 보여주기 위해 그 값을 그대로 쓴다({@link #isValidAdminCombination}이
     * {@code ADMIN_REVIEW+DAMAGED}를 허용). UNCERTAIN·FAILED는 {@link ItemCondition}에
     * 대응 값이 없어 호출부가 UNKNOWN을 넘긴다(EC2 실측: 이 호출 자체가 빠져 있어 파손
     * 판정된 반납도 슬롯이 AVAILABLE+OCCUPIED+NORMAL로 남아 대여 후보에 그대로 잡히는
     * 문제를 재현·확인함).
     */
    public void isolateForReview(ItemCondition observedItemCondition) {
        this.serviceStatus = ServiceStatus.ADMIN_REVIEW;
        this.itemCondition = observedItemCondition;
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
