package dev.billisan.device.repository;

import dev.billisan.device.domain.DeviceOperation;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeviceOperationRepository extends JpaRepository<DeviceOperation, UUID> {
}
