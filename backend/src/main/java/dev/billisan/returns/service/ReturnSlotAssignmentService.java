package dev.billisan.returns.service;

import dev.billisan.device.domain.DeviceOperation;
import dev.billisan.device.domain.DeviceOperation.OperationType;
import dev.billisan.device.repository.DeviceOperationRepository;
import dev.billisan.global.exception.NoReturnSlotException;
import dev.billisan.global.exception.ReturnAttemptNotFoundException;
import dev.billisan.returns.domain.ReturnAttempt;
import dev.billisan.returns.dto.ReturnSlotAssignmentResponse;
import dev.billisan.returns.dto.ReturnSlotAssignmentResponse.DeviceOperationView;
import dev.billisan.returns.repository.ReturnAttemptRepository;
import dev.billisan.slot.domain.Slot;
import dev.billisan.slot.repository.SlotRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** EDGE-RETURN-003 — Inspection 후 반납 가능한 빈 SLOT을 원자 선정하고 잠금 해제 작업을 만든다. */
@Service
public class ReturnSlotAssignmentService {

    private final ReturnAttemptRepository returnAttemptRepository;
    private final SlotRepository slotRepository;
    private final DeviceOperationRepository deviceOperationRepository;

    public ReturnSlotAssignmentService(
            ReturnAttemptRepository returnAttemptRepository,
            SlotRepository slotRepository,
            DeviceOperationRepository deviceOperationRepository) {
        this.returnAttemptRepository = returnAttemptRepository;
        this.slotRepository = slotRepository;
        this.deviceOperationRepository = deviceOperationRepository;
    }

    /** returnAttemptId가 자연 멱등 키다 — 이미 SLOT이 배정돼 있으면 새로 만들지 않고 그대로 되돌려준다. */
    @Transactional
    public ReturnSlotAssignmentResponse assignSlot(UUID returnAttemptId, UUID stationId) {
        ReturnAttempt returnAttempt = returnAttemptRepository.findByIdForUpdate(returnAttemptId)
                .orElseThrow(() -> new ReturnAttemptNotFoundException(
                        "returnAttemptId로 반납 시도를 찾을 수 없습니다: " + returnAttemptId));

        if (returnAttempt.getReturnSlotId() != null) {
            return toExistingResult(returnAttempt);
        }

        Slot slot = slotRepository.findReturnSlotCandidate(stationId)
                .orElseThrow(() -> new NoReturnSlotException("반납 가능한 슬롯이 없습니다: stationId=" + stationId));

        returnAttempt.assignReturnSlot(slot.getSlotId());

        DeviceOperation deviceOperation = deviceOperationRepository.save(
                DeviceOperation.request(stationId, slot.getSlotId(), OperationType.UNLOCK));

        return toResult(returnAttempt, slot, deviceOperation);
    }

    private ReturnSlotAssignmentResponse toExistingResult(ReturnAttempt returnAttempt) {
        Slot slot = slotRepository.findById(returnAttempt.getReturnSlotId())
                .orElseThrow(() -> new IllegalStateException(
                        "반납 시도에 연결된 슬롯을 찾을 수 없습니다(데이터 정합성 문제): " + returnAttempt.getReturnSlotId()));
        DeviceOperation deviceOperation = deviceOperationRepository
                .findFirstBySlotIdOrderByRequestedAtDesc(slot.getSlotId())
                .orElseThrow(() -> new IllegalStateException(
                        "슬롯에 연결된 장치 명령을 찾을 수 없습니다(데이터 정합성 문제): " + slot.getSlotId()));
        return toResult(returnAttempt, slot, deviceOperation);
    }

    private ReturnSlotAssignmentResponse toResult(
            ReturnAttempt returnAttempt, Slot slot, DeviceOperation deviceOperation) {
        return new ReturnSlotAssignmentResponse(
                returnAttempt.getReturnAttemptId(),
                slot.getSlotId(),
                slot.getSlotNumber(),
                new DeviceOperationView(
                        deviceOperation.getCommandId(),
                        deviceOperation.getOperationType().name(),
                        deviceOperation.getStatus().name()));
    }
}
