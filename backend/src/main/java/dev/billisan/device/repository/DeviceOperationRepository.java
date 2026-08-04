package dev.billisan.device.repository;

import dev.billisan.device.domain.DeviceOperation;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeviceOperationRepository extends JpaRepository<DeviceOperation, UUID> {

    Optional<DeviceOperation> findByCommandId(String commandId);

    /** EDGE-RETURN-003 멱등 재요청 — 이미 배정된 슬롯의 최신 UNLOCK 명령을 다시 조립한다. */
    Optional<DeviceOperation> findFirstBySlotIdOrderByRequestedAtDesc(UUID slotId);
}
