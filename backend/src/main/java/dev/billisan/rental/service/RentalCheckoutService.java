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

        Rental rental = rentalRepository.save(Rental.request(user.getUserId(), slot.getSlotId(), rentalRequestId));
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
                        UUID.fromString(deviceOperation.getCommandId()),
                        deviceOperation.getOperationType().name(),
                        deviceOperation.getStatus().name()));
    }
}
