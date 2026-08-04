package dev.billisan.device.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.billisan.device.domain.DeviceOperation;
import dev.billisan.device.dto.DeviceTerminalEventRequest;
import dev.billisan.device.dto.DeviceTerminalEventRequest.EventType;
import dev.billisan.device.dto.DeviceTerminalEventRequest.OperationType;
import dev.billisan.device.dto.DeviceTerminalEventResponse;
import dev.billisan.device.repository.DeviceOperationRepository;
import dev.billisan.global.exception.DeviceOperationNotFoundException;
import dev.billisan.global.exception.RentalNotFoundException;
import dev.billisan.global.exception.ReturnAttemptNotFoundException;
import dev.billisan.inspection.domain.DamageInspection;
import dev.billisan.inspection.repository.DamageInspectionRepository;
import dev.billisan.rental.domain.Rental;
import dev.billisan.rental.repository.RentalRepository;
import dev.billisan.returns.domain.ReturnAttempt;
import dev.billisan.returns.repository.ReturnAttemptRepository;
import dev.billisan.slot.domain.Slot;
import dev.billisan.slot.repository.SlotRepository;
import dev.billisan.user.domain.UserAccount;
import dev.billisan.user.repository.UserAccountRepository;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** EDGE-DEVICE-001 — Pi가 보고한 장치 Terminal 이벤트를 반영한다(대여/UNLOCK, 반납/LOCK 둘 다). */
@Service
public class DeviceTerminalEventService {

    private final RentalRepository rentalRepository;
    private final ReturnAttemptRepository returnAttemptRepository;
    private final DamageInspectionRepository damageInspectionRepository;
    private final UserAccountRepository userAccountRepository;
    private final SlotRepository slotRepository;
    private final DeviceOperationRepository deviceOperationRepository;
    private final ObjectMapper objectMapper;

    public DeviceTerminalEventService(
            RentalRepository rentalRepository,
            ReturnAttemptRepository returnAttemptRepository,
            DamageInspectionRepository damageInspectionRepository,
            UserAccountRepository userAccountRepository,
            SlotRepository slotRepository,
            DeviceOperationRepository deviceOperationRepository,
            ObjectMapper objectMapper) {
        this.rentalRepository = rentalRepository;
        this.returnAttemptRepository = returnAttemptRepository;
        this.damageInspectionRepository = damageInspectionRepository;
        this.userAccountRepository = userAccountRepository;
        this.slotRepository = slotRepository;
        this.deviceOperationRepository = deviceOperationRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public DeviceTerminalEventResponse recordTerminalEvent(DeviceTerminalEventRequest request) {
        return request.operationType() == OperationType.LOCK
                ? recordReturnLockEvent(request)
                : recordRentalUnlockEvent(request);
    }

    private DeviceTerminalEventResponse recordRentalUnlockEvent(DeviceTerminalEventRequest request) {
        Rental rental = rentalRepository.findByIdForUpdate(request.rentalId())
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

    private DeviceTerminalEventResponse recordReturnLockEvent(DeviceTerminalEventRequest request) {
        ReturnAttempt returnAttempt = returnAttemptRepository.findByIdForUpdate(request.returnAttemptId())
                .orElseThrow(() -> new ReturnAttemptNotFoundException(
                        "returnAttemptId로 반납 시도를 찾을 수 없습니다: " + request.returnAttemptId()));

        DeviceOperation deviceOperation = deviceOperationRepository.findByCommandId(request.commandId())
                .orElseThrow(() -> new DeviceOperationNotFoundException(
                        "commandId로 장치 명령을 찾을 수 없습니다: " + request.commandId()));

        LocalDateTime now = LocalDateTime.now();

        if (deviceOperation.isTerminal()) {
            return new DeviceTerminalEventResponse(
                    request.eventId(), request.commandId(), deviceOperation.getStatus().name(),
                    returnAttempt.getStatus().name(), "CONSISTENT", now);
        }

        // deviceOperation이 물고 있는 slotId를 쓴다 — returnAttempt.returnSlotId가 아니다.
        // commandId로 찾은 이 명령이 실제로 어느 슬롯을 잠갔는지의 유일한 근거는
        // deviceOperation 쪽이라, 그걸 그대로 물리 상태 갱신에 쓴다.
        Slot slot = slotRepository.findById(deviceOperation.getSlotId())
                .orElseThrow(() -> new IllegalStateException(
                        "장치 명령에 연결된 슬롯을 찾을 수 없습니다(데이터 정합성 문제): " + deviceOperation.getSlotId()));

        if (request.eventType() == EventType.OPERATION_COMPLETED) {
            slot.applyObservedPhysicalState(
                    request.evidence().after().occupancyStatus(),
                    request.evidence().after().lockStatus());
            returnAttempt.markPhysicalDone(now);
            applyInspectionOutcome(returnAttempt, now);
            recordOutcome(deviceOperation, request, DeviceOperation.Status.SUCCEEDED,
                    DeviceOperation.TerminalEventType.OPERATION_COMPLETED, now);
        } else {
            // OPERATION_FAILED · TIMED_OUT 둘 다 Pi 스스로 실패로 보고한 것 — returnAttempt는
            // PROCESSING으로 그대로 두고 slot만 사람이 확인할 대상으로 뺀다. returnAttempt를
            // 재시도 가능한 상태로 되돌리는 로직은 아직 없다(별도 확인 필요).
            slot.isolateForReview();
            if (request.eventType() == EventType.OPERATION_FAILED) {
                recordOutcome(deviceOperation, request, DeviceOperation.Status.FAILED,
                        DeviceOperation.TerminalEventType.OPERATION_FAILED, now);
            } else {
                recordOutcome(deviceOperation, request, DeviceOperation.Status.TIMED_OUT, null, now);
            }
        }

        return new DeviceTerminalEventResponse(
                request.eventId(), request.commandId(), deviceOperation.getStatus().name(),
                returnAttempt.getStatus().name(), "CONSISTENT", now);
    }

    /**
     * 검수 결과가 아직 없으면(순서가 꼬여 도착) 자동 완료시키지 않고 보수적으로
     * RECOVERY_REQUIRED로 보낸다 — 안전 쪽으로 판단(팀 확정).
     */
    private void applyInspectionOutcome(ReturnAttempt returnAttempt, LocalDateTime now) {
        boolean reviewRequired = damageInspectionRepository
                .findFirstByReturnAttemptIdOrderByCreatedAtDesc(returnAttempt.getReturnAttemptId())
                .map(DamageInspection::requiresReview)
                .orElse(true);

        if (reviewRequired) {
            returnAttempt.requireRecovery();
            return;
        }

        returnAttempt.complete(now);

        Rental rental = rentalRepository.findById(returnAttempt.getRentalId())
                .orElseThrow(() -> new IllegalStateException(
                        "반납 시도에 연결된 대여를 찾을 수 없습니다(데이터 정합성 문제): " + returnAttempt.getRentalId()));
        rental.complete(now);

        UserAccount user = userAccountRepository.findById(rental.getUserId())
                .orElseThrow(() -> new IllegalStateException(
                        "대여에 연결된 사용자를 찾을 수 없습니다(데이터 정합성 문제): " + rental.getUserId()));
        user.changeRentalEligibility(true);
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
