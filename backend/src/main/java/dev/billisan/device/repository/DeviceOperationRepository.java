package dev.billisan.device.repository;

import dev.billisan.device.domain.DeviceOperation;
import dev.billisan.device.domain.DeviceOperation.Status;
import dev.billisan.device.domain.DeviceOperation.TerminalEventType;
import dev.billisan.slot.domain.Slot.LockStatus;
import dev.billisan.slot.domain.Slot.OccupancyStatus;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DeviceOperationRepository extends JpaRepository<DeviceOperation, UUID> {

    /**
     * EDGE-DEVICE-001 — device_operation은 순수 기록용이라 조회 없이 commandId 기준으로 바로 덮어쓴다. 
     * 반환값(영향받은 행 수)이 0이면 commandId가 존재하지 않는다는 뜻이라
     * 호출부에서 로그로만 남긴다(rental/slot 갱신은 이미 끝난 뒤라 실패 처리하지 않음).
     */
    @Modifying
    @Query("""
            update DeviceOperation d
            set d.status = :status,
                d.eventId = :eventId,
                d.terminalEventType = :terminalEventType,
                d.resultCode = :resultCode,
                d.observedOccupancyStatus = :observedOccupancyStatus,
                d.observedLockStatus = :observedLockStatus,
                d.evidenceSchemaVersion = :evidenceSchemaVersion,
                d.evidenceObservedAt = :evidenceObservedAt,
                d.evidencePayload = :evidencePayload,
                d.completedAt = :completedAt,
                d.updatedAt = :completedAt
            where d.commandId = :commandId
            """)
    int recordTerminalEvent(
            @Param("commandId") String commandId,
            @Param("status") Status status,
            @Param("eventId") String eventId,
            @Param("terminalEventType") TerminalEventType terminalEventType,
            @Param("resultCode") String resultCode,
            @Param("observedOccupancyStatus") OccupancyStatus observedOccupancyStatus,
            @Param("observedLockStatus") LockStatus observedLockStatus,
            @Param("evidenceSchemaVersion") Short evidenceSchemaVersion,
            @Param("evidenceObservedAt") LocalDateTime evidenceObservedAt,
            @Param("evidencePayload") String evidencePayload,
            @Param("completedAt") LocalDateTime completedAt);
}
