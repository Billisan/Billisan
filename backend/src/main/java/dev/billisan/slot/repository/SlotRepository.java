package dev.billisan.slot.repository;

import dev.billisan.slot.domain.Slot;
import dev.billisan.slot.domain.Slot.ItemCondition;
import dev.billisan.slot.domain.Slot.LockStatus;
import dev.billisan.slot.domain.Slot.OccupancyStatus;
import dev.billisan.slot.domain.Slot.ServiceStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SlotRepository extends JpaRepository<Slot, UUID> {

    List<Slot> findByStationIdOrderBySlotNumber(UUID stationId);

    /**
     * findById만으로는 두 요청이 동시에 같은 updatedAt을 읽고 CAS를 통과한 뒤 순서대로
     * 덮어쓰는 lost update가 가능하다(리뷰로 발견) — 조회 시점에 행을 잠가 뒤 트랜잭션이
     * 앞 트랜잭션 커밋 전까지 대기하게 한다. 스키마에 없는 @Version 컬럼 대신 쓴다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Slot s where s.slotId = :slotId")
    Optional<Slot> findByIdForUpdate(@Param("slotId") UUID slotId);

    long countByStationId(UUID stationId);

    long countByStationIdAndOccupancyStatus(UUID stationId, OccupancyStatus occupancyStatus);

    long countByStationIdAndServiceStatus(UUID stationId, ServiceStatus serviceStatus);

    long countByStationIdAndItemCondition(UUID stationId, ItemCondition itemCondition);

    /**
     * "대여 가능한 우산이 있는 슬롯" — CLAUDE.md 신규 대여 조건(AVAILABLE+OCCUPIED+NORMAL+
     * LOCKED)과 동일 기준. ⚠️ 재확인 필요: DB 담당의 재고 집계 쿼리가 이 조건에
     * "대기 중인 REQUESTED 대여·진행 중인 DEVICE_OPERATION이 없어야 함"까지 추가로 확인하고
     * 있다면 이 카운트와 어긋날 수 있다 — RENTAL/DEVICE_OPERATION 도메인 로직이 이 브랜치에
     * 아직 없어서 그 조건은 반영하지 못했다.
     */
    long countByStationIdAndServiceStatusAndOccupancyStatusAndLockStatusAndItemCondition(
            UUID stationId,
            ServiceStatus serviceStatus,
            OccupancyStatus occupancyStatus,
            LockStatus lockStatus,
            ItemCondition itemCondition);
}
