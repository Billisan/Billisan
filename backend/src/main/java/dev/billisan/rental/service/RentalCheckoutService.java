package dev.billisan.rental.service;

import dev.billisan.device.domain.DeviceOperation;
import dev.billisan.device.domain.DeviceOperation.OperationType;
import dev.billisan.device.repository.DeviceOperationRepository;
import dev.billisan.global.exception.ActiveRentalConflictException;
import dev.billisan.global.exception.IdempotencyConflictException;
import dev.billisan.global.exception.NoAvailableSlotException;
import dev.billisan.global.exception.UserNotFoundException;
import dev.billisan.rental.domain.Rental;
import dev.billisan.rental.dto.RentalCheckoutResponse;
import dev.billisan.rental.dto.RentalCheckoutResponse.DeviceOperationView;
import dev.billisan.rental.repository.RentalRepository;
import dev.billisan.slot.domain.Slot;
import dev.billisan.slot.repository.SlotRepository;
import dev.billisan.user.domain.UserAccount;
import dev.billisan.user.repository.UserAccountRepository;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** EDGE-RENT-001 — 대여 요청을 받아 checkout 슬롯을 선정하고 대여·장치 명령 기록을 만든다. */
@Service
public class RentalCheckoutService {

    private final UserAccountRepository userAccountRepository;
    private final SlotRepository slotRepository;
    private final RentalRepository rentalRepository;
    private final DeviceOperationRepository deviceOperationRepository;

    public RentalCheckoutService(
            UserAccountRepository userAccountRepository,
            SlotRepository slotRepository,
            RentalRepository rentalRepository,
            DeviceOperationRepository deviceOperationRepository) {
        this.userAccountRepository = userAccountRepository;
        this.slotRepository = slotRepository;
        this.rentalRepository = rentalRepository;
        this.deviceOperationRepository = deviceOperationRepository;
    }

    /**
     * 같은 rentalRequestId 재전송은 여기서 새로 만들지 않고 바로 거절한다
     * — 유실된 응답 복구는 EDGE-RENT-002(대여 요청 결과 복구 조회)의 책임이라,
     * EDGE-RENT-001이 재전송에 대해 기존 결과를 재구성해줄 필요가 없다.
     */
    @Transactional
    public RentalCheckoutResponse requestCheckout(String rentalRequestId, UUID stationId, UUID userRef) {
        if (rentalRepository.findByRentalRequestId(rentalRequestId).isPresent()) {
            throw new IdempotencyConflictException(
                    "이미 처리된 rentalRequestId입니다. 결과가 필요하면 EDGE-RENT-002로 조회하세요: " + rentalRequestId);
        }

        UserAccount user = requireUser(userRef);

        if (!user.isRentalEligible()) {
            throw new ActiveRentalConflictException("사용자가 대여 자격이 없습니다: " + userRef);
        }

        Slot slot = slotRepository.findRentCheckoutCandidate(stationId)
                .orElseThrow(() -> new NoAvailableSlotException("대여 가능한 슬롯이 없습니다: stationId=" + stationId));

        Rental rental;
        try {
            // saveAndFlush로 즉시 INSERT를 실행해야, QoS 1 재전송으로 같은 rentalRequestId가
            // 거의 동시에 들어와 UK_RENTAL_REQUEST_ID를 위반하는 경우를 여기서 바로 잡을 수
            // 있다(리뷰로 발견) — save()만 쓰면 위반이 이 트랜잭션의 나중 flush 시점까지
            // 미뤄져, 실제로는 실패한 요청인데도 성공 응답이 나갈 뻔했다.
            rental = rentalRepository.saveAndFlush(Rental.request(user.getUserId(), slot.getSlotId(), rentalRequestId));
        } catch (DataIntegrityViolationException e) {
            throw new IdempotencyConflictException(
                    "동시에 재전송된 rentalRequestId입니다: " + rentalRequestId);
        }

        // 1시간 배치를 기다리지 않고 즉시 반영 — 안 그러면 배치가 돌기 전까지 이 사용자가
        // 활성 대여를 가진 채로 또 대여를 시도할 수 있다(리뷰로 발견). 반납 완료 시 다시
        // true로 되돌리는 건 반납 기능 쪽 책임.
        user.changeRentalEligibility(false);

        DeviceOperation deviceOperation =
                deviceOperationRepository.save(DeviceOperation.request(stationId, slot.getSlotId(), OperationType.UNLOCK));

        return toResult(rental, slot, deviceOperation);
    }

    private UserAccount requireUser(UUID userRef) {
        return userAccountRepository.findByUserRef(userRef)
                .orElseThrow(() -> new UserNotFoundException("userRef로 사용자를 찾을 수 없습니다: " + userRef));
    }

    private RentalCheckoutResponse toResult(Rental rental, Slot slot, DeviceOperation deviceOperation) {
        return new RentalCheckoutResponse(
                rental.getRentalId(),
                rental.getStatus().name(),
                slot.getSlotId(),
                slot.getSlotNumber(),
                new DeviceOperationView(
                        deviceOperation.getCommandId(),
                        deviceOperation.getOperationType().name(),
                        deviceOperation.getStatus().name()));
    }
}
