package dev.billisan.device.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.billisan.device.domain.DeviceOperation;
import dev.billisan.device.dto.DeviceTerminalEventRequest;
import dev.billisan.device.dto.DeviceTerminalEventRequest.EventType;
import dev.billisan.device.dto.DeviceTerminalEventResponse;
import dev.billisan.device.repository.DeviceOperationRepository;
import dev.billisan.global.exception.DeviceOperationNotFoundException;
import dev.billisan.global.exception.RentalNotFoundException;
import dev.billisan.global.exception.UnsupportedDeviceEventException;
import dev.billisan.rental.domain.Rental;
import dev.billisan.rental.repository.RentalRepository;
import dev.billisan.slot.domain.Slot;
import dev.billisan.slot.repository.SlotRepository;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** EDGE-DEVICE-001 — Pi가 보고한 장치 Terminal 이벤트를 반영한다(대여/UNLOCK 확인 경로만). */
@Service
public class DeviceTerminalEventService {

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

        DeviceOperation deviceOperation = deviceOperationRepository.findByCommandId(request.commandId())
                .orElseThrow(() -> new DeviceOperationNotFoundException(
                        "commandId로 장치 명령을 찾을 수 없습니다: " + request.commandId()));

        LocalDateTime now = LocalDateTime.now();

        // device_operation이 이미 종결 상태면 이전에 처리된 이벤트다 — Rental.status만으로
        // 판단하면 실패 시 Rental이 REQUESTED에 그대로 남아있어서, 뒤늦게 도착한 성공
        // 이벤트가 이미 실패 처리된 명령을 다시 성공으로 뒤집을 수 있었다(리뷰로 발견).
        if (deviceOperation.isTerminal()) {
            return new DeviceTerminalEventResponse(
                    request.eventId(), request.commandId(), deviceOperation.getStatus().name(),
                    rental.getStatus().name(), "CONSISTENT", now);
        }

        Slot slot = slotRepository.findById(rental.getCheckoutSlotId())
                .orElseThrow(() -> new IllegalStateException(
                        "대여에 연결된 슬롯을 찾을 수 없습니다(데이터 정합성 문제): " + rental.getCheckoutSlotId()));

        if (request.eventType() == EventType.OPERATION_COMPLETED) {
            rental.activate(now);
            slot.applyObservedPhysicalState(
                    request.evidence().after().occupancyStatus(),
                    request.evidence().after().lockStatus());
            recordOutcome(deviceOperation, request, DeviceOperation.Status.SUCCEEDED,
                    DeviceOperation.TerminalEventType.OPERATION_COMPLETED, now);
        } else {
            // OPERATION_FAILED · TIMED_OUT 둘 다 Pi 스스로 실패로 보고한 것 — rental은
            // REQUESTED로 그대로 두고 slot만 사람이 확인할 대상으로 뺀다.
            slot.isolateForReview();
            if (request.eventType() == EventType.OPERATION_FAILED) {
                recordOutcome(deviceOperation, request, DeviceOperation.Status.FAILED,
                        DeviceOperation.TerminalEventType.OPERATION_FAILED, now);
            } else {
                // DB의 CK_DEVICE_OPERATION_TERMINAL_EVENT_TYPE은 TIMED_OUT을 허용하지
                // 않아 이 컬럼은 NULL로 둔다.
                recordOutcome(deviceOperation, request, DeviceOperation.Status.TIMED_OUT, null, now);
            }
        }

        return new DeviceTerminalEventResponse(
                request.eventId(), request.commandId(), deviceOperation.getStatus().name(),
                rental.getStatus().name(), "CONSISTENT", now);
    }

    private void recordOutcome(
            DeviceOperation deviceOperation,
            DeviceTerminalEventRequest request,
            DeviceOperation.Status status,
            DeviceOperation.TerminalEventType terminalEventType,
            LocalDateTime completedAt) {
        deviceOperation.recordTerminalOutcome(
                status,
                terminalEventType,
                request.eventId().toString(),
                request.resultCode(),
                request.evidence().after().occupancyStatus(),
                request.evidence().after().lockStatus(),
                (short) request.evidence().schemaVersion(),
                request.evidence().observedAt(),
                writeEvidenceJson(request.evidence()),
                completedAt);
    }

    private String writeEvidenceJson(DeviceTerminalEventRequest.Evidence evidence) {
        try {
            return objectMapper.writeValueAsString(evidence);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("evidence 직렬화에 실패했습니다", e);
        }
    }
}
