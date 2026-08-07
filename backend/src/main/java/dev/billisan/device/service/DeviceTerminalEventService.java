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
import dev.billisan.global.exception.ReturnAttemptNotFoundException;
import dev.billisan.inspection.domain.DamageInspection;
import dev.billisan.inspection.repository.DamageInspectionRepository;
import dev.billisan.rental.domain.Rental;
import dev.billisan.rental.repository.RentalRepository;
import dev.billisan.returns.domain.ReturnAttempt;
import dev.billisan.returns.repository.ReturnAttemptRepository;
import dev.billisan.slot.domain.Slot;
import dev.billisan.slot.domain.Slot.ItemCondition;
import dev.billisan.slot.domain.Slot.OccupancyStatus;
import dev.billisan.slot.domain.Slot.ServiceStatus;
import dev.billisan.slot.repository.SlotRepository;
import dev.billisan.user.domain.UserAccount;
import dev.billisan.user.repository.UserAccountRepository;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** EDGE-DEVICE-001 — Pi가 보고한 장치 Terminal 이벤트를 반영한다(대여/UNLOCK, 반납/LOCK 둘 다). */
@Service
public class DeviceTerminalEventService {

    private static final Logger log = LoggerFactory.getLogger(DeviceTerminalEventService.class);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

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
        if (request.eventType() == EventType.PHYSICAL_STATE_CONFIRMED) {
            return recordPhysicalStateConfirmation(request);
        }
        return request.returnAttemptId() != null
                ? recordReturnLockEvent(request)
                : recordRentalUnlockEvent(request);
    }

    /**
     * 체크아웃 UNLOCK 완료 후 Pi가 스스로 재잠금을 감지해 자발적으로 보내는 재확인
     * 이벤트 — 사전에 발급된 commandId가 없어 slotId로 대상을 찾는다(팀 결정: (B)).
     * Rental.activate()는 이 이벤트와 무관하게 이미 UNLOCK 완료 시점에 끝나 있으므로
     * 여기서는 손대지 않는다.
     *
     * <p>센서가 관측한 물리 상태는 DB에 매칭되는 ACTIVE 대여가 있는지와 무관한 사실이라,
     * ACTIVE 대여를 못 찾아도 occupancy 동기화는 그대로 수행한다(리뷰로 발견) — 그렇지
     * 않으면 대여가 어떤 이유로든 먼저 종료·유실된 슬롯이 실제로는 비었는데도 DB엔
     * OCCUPIED로 남아, findRentCheckoutCandidate가 빈 슬롯을 다시 대여 후보로 내줄 수
     * 있다. 재확인해도 여전히 OCCUPIED면(아직 안 뺐음) 슬롯은 격리하지 않고 로그만
     * 남긴다(팀 결정).
     */
    private DeviceTerminalEventResponse recordPhysicalStateConfirmation(DeviceTerminalEventRequest request) {
        Slot slot = slotRepository.findByIdForUpdate(request.slotId())
                .orElseThrow(() -> new IllegalStateException(
                        "slotId로 슬롯을 찾을 수 없습니다: " + request.slotId()));

        DeviceOperation deviceOperation = DeviceOperation.request(
                slot.getStationId(), slot.getSlotId(), DeviceOperation.OperationType.PHYSICAL_STATE_CONFIRM);
        LocalDateTime now = LocalDateTime.now();

        Optional<Rental> activeRental = rentalRepository
                .findFirstByCheckoutSlotIdAndStatusOrderByRequestedAtDesc(slot.getSlotId(), Rental.Status.ACTIVE);

        Slot.OccupancyStatus observedOccupancyStatus = request.evidence().after().occupancyStatus();
        slot.applyObservedPhysicalState(observedOccupancyStatus, request.evidence().after().lockStatus());

        if (activeRental.isEmpty()) {
            log.warn("PHYSICAL_STATE_CONFIRMED 도착했지만 slotId={}에 ACTIVE 대여가 없습니다 — occupancy만 동기화합니다",
                    slot.getSlotId());
        } else if (observedOccupancyStatus == Slot.OccupancyStatus.OCCUPIED) {
            log.warn("PHYSICAL_STATE_CONFIRMED 재확인에도 여전히 OCCUPIED입니다 — rentalId={}, slotId={}",
                    activeRental.get().getRentalId(), slot.getSlotId());
        }

        recordOutcome(deviceOperation, request,
                activeRental.isEmpty() ? DeviceOperation.Status.OUTCOME_UNKNOWN : DeviceOperation.Status.SUCCEEDED,
                DeviceOperation.TerminalEventType.OPERATION_COMPLETED, now);
        deviceOperationRepository.save(deviceOperation);

        return new DeviceTerminalEventResponse(
                request.eventId(), deviceOperation.getCommandId(), deviceOperation.getStatus().name(),
                activeRental.map(r -> r.getStatus().name()).orElse("NO_ACTIVE_RENTAL"),
                "CONSISTENT", now, buildInventory(slot.getStationId()));
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
                    rental.getStatus().name(), "CONSISTENT", now, buildInventory(deviceOperation.getStationId()));
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
                rental.getStatus().name(), "CONSISTENT", now, buildInventory(deviceOperation.getStationId()));
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
                    returnAttempt.getStatus().name(), "CONSISTENT", now, buildInventory(deviceOperation.getStationId()));
        }

        // deviceOperation이 물고 있는 slotId를 쓴다 — returnAttempt.returnSlotId가 아니다.
        // commandId로 찾은 이 명령이 실제로 어느 슬롯을 잠갔는지의 유일한 근거는
        // deviceOperation 쪽이라, 그걸 그대로 물리 상태 갱신에 쓴다.
        Slot slot = slotRepository.findById(deviceOperation.getSlotId())
                .orElseThrow(() -> new IllegalStateException(
                        "장치 명령에 연결된 슬롯을 찾을 수 없습니다(데이터 정합성 문제): " + deviceOperation.getSlotId()));

        if (request.eventType() == EventType.OPERATION_COMPLETED) {
            Slot.OccupancyStatus observedOccupancyStatus = request.evidence().after().occupancyStatus();
            slot.applyObservedPhysicalState(observedOccupancyStatus, request.evidence().after().lockStatus());
            if (observedOccupancyStatus == Slot.OccupancyStatus.OCCUPIED) {
                returnAttempt.markPhysicalDone(now);
                applyInspectionOutcome(returnAttempt, slot, now);
            } else {
                // 반납 LOCK 성공(SUCCEEDED)으로 보고됐지만 슬롯에 우산이 감지되지 않음 —
                // 반납이 실제로는 안 됐을 가능성이 높다(EC2 실측으로 확인된 재발급 버그).
                // 물리적으로 반납이 끝난 게 아니므로 markPhysicalDone(physicalCompletedAt 기록)은
                // 건너뛰고 바로 RECOVERY_REQUIRED로 보내 사람이 확인하게 하고, 슬롯도
                // 대여/반납 후보에서 뺀다.
                returnAttempt.requireRecovery();
                slot.isolateForReview();
            }
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
                returnAttempt.getStatus().name(), "CONSISTENT", now, buildInventory(deviceOperation.getStationId()));
    }

    /**
     * 검수 결과가 아직 없으면(순서가 꼬여 도착) 자동 완료시키지 않고 보수적으로
     * RECOVERY_REQUIRED로 보낸다 — 안전 쪽으로 판단(팀 확정).
     *
     * 두 분기 모두 슬롯의 itemCondition을 확정한다(EC2 실측으로 재현·확인한 버그 수정,
     * BILL-XXX): 이전에는 이 메서드가 returnAttempt·rental·user만 갱신하고 슬롯은
     * applyObservedPhysicalState()가 이미 바꾼 occupancy·lock 외엔 손대지 않아, 정상
     * 반납은 itemCondition이 예전 값에 머물고, 파손·불확실 반납은 슬롯이 격리조차 안 되어
     * AVAILABLE+OCCUPIED로 남아 대여 후보에 그대로 잡혔다.
     */
    private void applyInspectionOutcome(ReturnAttempt returnAttempt, Slot slot, LocalDateTime now) {
        Optional<DamageInspection> inspection = damageInspectionRepository
                .findFirstByReturnAttemptIdOrderByCreatedAtDesc(returnAttempt.getReturnAttemptId());
        boolean reviewRequired = inspection.map(DamageInspection::requiresReview).orElse(true);

        if (reviewRequired) {
            returnAttempt.requireRecovery();
            slot.isolateForReview(reviewRequiredItemCondition(inspection));
            return;
        }

        returnAttempt.complete(now);
        slot.confirmNormalItemCondition();

        Rental rental = rentalRepository.findById(returnAttempt.getRentalId())
                .orElseThrow(() -> new IllegalStateException(
                        "반납 시도에 연결된 대여를 찾을 수 없습니다(데이터 정합성 문제): " + returnAttempt.getRentalId()));
        rental.complete(now);

        UserAccount user = userAccountRepository.findById(rental.getUserId())
                .orElseThrow(() -> new IllegalStateException(
                        "대여에 연결된 사용자를 찾을 수 없습니다(데이터 정합성 문제): " + rental.getUserId()));
        user.changeRentalEligibility(true);
    }

    /**
     * AI가 DAMAGED로 명확히 판정했을 때만 그 값을 그대로 슬롯에 반영해 관리자에게 더
     * 구체적인 정보를 준다({@code ADMIN_REVIEW+DAMAGED}는 {@code Slot.isValidAdminCombination}
     * 이 허용하는 조합). UNCERTAIN, 검수 결과 자체가 없는 경우, {@code aiResult}가 null인
     * FAILED는 {@code ItemCondition}에 대응 값이 없어 UNKNOWN으로 격리한다.
     */
    private ItemCondition reviewRequiredItemCondition(Optional<DamageInspection> inspection) {
        return inspection
                .map(DamageInspection::getAiResult)
                .filter(aiResult -> aiResult == DamageInspection.AiResult.DAMAGED)
                .map(aiResult -> ItemCondition.DAMAGED)
                .orElse(ItemCondition.UNKNOWN);
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
                toKstLocalDateTime(request.evidence().observedAt()),
                writeEvidenceJson(request.evidence()),
                completedAt);
    }

    /**
     * 장치 오류·페이로드 누락으로 observedAt이 비어 올 수 있다 — null이면 그대로 null을
     * 넘긴다(DB 컬럼도 NULL 허용, CK_DEVICE_OPERATION_LIFECYCLE_TIME_ORDER도 NULL은
     * 통과시킨다). 리뷰로 발견: Instant 전환 전에는 이 케이스가 문제없이 NULL로 저장됐는데,
     * atZone을 무조건 호출하도록 바꾸면서 NPE로 이벤트 처리 전체가 실패할 뻔했다.
     */
    private LocalDateTime toKstLocalDateTime(Instant instant) {
        return instant == null ? null : instant.atZone(KST).toLocalDateTime();
    }

    /**
     * EDGE-DEVICE-001 응답용 재고 스냅샷. Slot 갱신은 같은 트랜잭션·영속성 컨텍스트 안에서
     * 일어나므로, 이 카운트 쿼리 직전에 Hibernate가 변경분을 자동 flush해 방금 반영된 값을
     * 그대로 읽는다(대여 성공 → 차감분 반영, 반납 성공 → 반영분 포함).
     */
    private DeviceTerminalEventResponse.Inventory buildInventory(UUID stationId) {
        int rentable = (int) slotRepository.countByStationIdAndServiceStatusAndOccupancyStatusAndItemCondition(
                stationId, ServiceStatus.AVAILABLE, OccupancyStatus.OCCUPIED, ItemCondition.NORMAL);
        int emptyReturn = (int) slotRepository.countByStationIdAndServiceStatusAndOccupancyStatus(
                stationId, ServiceStatus.AVAILABLE, OccupancyStatus.EMPTY);
        int total = (int) slotRepository.countByStationId(stationId);
        return new DeviceTerminalEventResponse.Inventory(rentable, emptyReturn, total);
    }

    private String writeEvidenceJson(DeviceTerminalEventRequest.Evidence evidence) {
        try {
            return objectMapper.writeValueAsString(evidence);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("evidence 직렬화에 실패했습니다", e);
        }
    }
}
