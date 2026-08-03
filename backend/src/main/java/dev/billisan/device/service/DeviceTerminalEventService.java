package dev.billisan.device.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.billisan.device.domain.DeviceOperation;
import dev.billisan.device.dto.DeviceTerminalEventRequest;
import dev.billisan.device.dto.DeviceTerminalEventRequest.EventType;
import dev.billisan.device.dto.DeviceTerminalEventResponse;
import dev.billisan.device.repository.DeviceOperationRepository;
import dev.billisan.global.exception.RentalNotFoundException;
import dev.billisan.global.exception.UnsupportedDeviceEventException;
import dev.billisan.rental.domain.Rental;
import dev.billisan.rental.repository.RentalRepository;
import dev.billisan.slot.domain.Slot;
import dev.billisan.slot.repository.SlotRepository;
import java.time.LocalDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** EDGE-DEVICE-001 — Pi가 보고한 장치 Terminal 이벤트를 반영한다(대여/UNLOCK 확인 경로만). */
@Service
public class DeviceTerminalEventService {

    private static final Logger log = LoggerFactory.getLogger(DeviceTerminalEventService.class);

    private final RentalRepository rentalRepository;
    private final SlotRepository slotRepository;
    private final DeviceOperationRepository deviceOperationRepository;
    private final ObjectMapper objectMapper;

    public DeviceTerminalEventService(
            RentalRepository rentalRepository,
            SlotRepository slotRepository,
            DeviceOperationRepository deviceOperationRepository,
            ObjectMapper objectMapper) {
        this.rentalRepository = rentalRepository;
        this.slotRepository = slotRepository;
        this.deviceOperationRepository = deviceOperationRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public DeviceTerminalEventResponse recordTerminalEvent(DeviceTerminalEventRequest request) {
        if (request.returnAttemptId() != null) {
            throw new UnsupportedDeviceEventException(
                    "반납(LOCK) 이벤트는 아직 지원하지 않습니다: returnAttemptId=" + request.returnAttemptId());
        }

        Rental rental = rentalRepository.findById(request.rentalId())
                .orElseThrow(() -> new RentalNotFoundException("rentalId로 대여를 찾을 수 없습니다: " + request.rentalId()));

        LocalDateTime now = LocalDateTime.now();

        // 이미 REQUESTED를 벗어났다면 이전에 처리된 이벤트다
        // — device_operation은 순수 기록용이라 다시 조회해 "정확히 왜 중복인지"는 따지지 않고,
        // Rental 상태만으로 재처리 여부를 판단한다.
        if (rental.getStatus() != Rental.Status.REQUESTED) {
            String inferredDeviceOperationStatus = rental.getStatus() == Rental.Status.ACTIVE
                    ? DeviceOperation.Status.SUCCEEDED.name()
                    : DeviceOperation.Status.OUTCOME_UNKNOWN.name();
            return new DeviceTerminalEventResponse(
                    request.eventId(), request.commandId(), inferredDeviceOperationStatus,
                    rental.getStatus().name(), "CONSISTENT", now);
        }

        Slot slot = slotRepository.findById(rental.getCheckoutSlotId())
                .orElseThrow(() -> new IllegalStateException(
                        "대여에 연결된 슬롯을 찾을 수 없습니다(데이터 정합성 문제): " + rental.getCheckoutSlotId()));

        DeviceOperation.Status deviceStatus;
        DeviceOperation.TerminalEventType terminalEventType;

        if (request.eventType() == EventType.OPERATION_COMPLETED) {
            // OPERATION_COMPLETED — rental과 slot을 갱신하고 device_operation을 SUCCEEDED로 기록한다.
            rental.activate(now);
            slot.applyObservedPhysicalState(
                    request.evidence().after().occupancyStatus(),
                    request.evidence().after().lockStatus());
            deviceStatus = DeviceOperation.Status.SUCCEEDED;
            terminalEventType = DeviceOperation.TerminalEventType.OPERATION_COMPLETED;
        } else {
            // OPERATION_FAILED · TIMED_OUT:  둘 다 Pi 스스로 실패로 보고한 것
            // — rental은 REQUESTED로 그대로 두고 slot만 사람이 확인할 대상으로 뺀다.
            slot.isolateForReview();
            if (request.eventType() == EventType.OPERATION_FAILED) {
                deviceStatus = DeviceOperation.Status.FAILED;
                terminalEventType = DeviceOperation.TerminalEventType.OPERATION_FAILED;
            } else {
                deviceStatus = DeviceOperation.Status.TIMED_OUT;
                // DB의 CK_DEVICE_OPERATION_TERMINAL_EVENT_TYPE은
                // TIMED_OUT을 허용하지 않아 이 컬럼은 NULL로 둔다.
                terminalEventType = null;
            }
        }

        int updated = deviceOperationRepository.recordTerminalEvent(
                request.commandId(),
                deviceStatus,
                request.eventId().toString(),
                terminalEventType,
                request.resultCode(),
                request.evidence().after().occupancyStatus(),
                request.evidence().after().lockStatus(),
                (short) request.evidence().schemaVersion(),
                request.evidence().observedAt(),
                writeEvidenceJson(request.evidence()),
                now);
        if (updated == 0) {
            log.warn("commandId에 해당하는 device_operation을 찾지 못해 갱신하지 못했습니다: {}", request.commandId());
        }

        return new DeviceTerminalEventResponse(
                request.eventId(), request.commandId(), deviceStatus.name(),
                rental.getStatus().name(), "CONSISTENT", now);
    }

    private String writeEvidenceJson(DeviceTerminalEventRequest.Evidence evidence) {
        try {
            return objectMapper.writeValueAsString(evidence);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("evidence 직렬화에 실패했습니다", e);
        }
    }
}
