package dev.billisan.returns.service;

import dev.billisan.global.exception.ActiveRentalNotFoundException;
import dev.billisan.global.exception.IdempotencyConflictException;
import dev.billisan.global.exception.UserNotFoundException;
import dev.billisan.rental.domain.Rental;
import dev.billisan.rental.repository.RentalRepository;
import dev.billisan.returns.domain.ReturnAttempt;
import dev.billisan.returns.dto.ReturnAttemptResponse;
import dev.billisan.returns.repository.ReturnAttemptRepository;
import dev.billisan.user.domain.UserAccount;
import dev.billisan.user.repository.UserAccountRepository;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** EDGE-RETURN-001 — 활성 대여를 검증하고 SLOT 미선정 상태로 반납 시도를 생성한다. */
@Service
public class ReturnAttemptService {

    private final UserAccountRepository userAccountRepository;
    private final RentalRepository rentalRepository;
    private final ReturnAttemptRepository returnAttemptRepository;

    public ReturnAttemptService(
            UserAccountRepository userAccountRepository,
            RentalRepository rentalRepository,
            ReturnAttemptRepository returnAttemptRepository) {
        this.userAccountRepository = userAccountRepository;
        this.rentalRepository = rentalRepository;
        this.returnAttemptRepository = returnAttemptRepository;
    }

    /**
     * 같은 requestId 재전송은 여기서 새로 만들지 않고 바로 거절한다
     * — RentalCheckoutService와 동일하게, 유실된 응답 복구는 이 오퍼레이션의 책임이 아니다.
     */
    @Transactional
    public ReturnAttemptResponse requestReturn(String requestId, UUID userRef) {
        if (returnAttemptRepository.findByRequestId(requestId).isPresent()) {
            throw new IdempotencyConflictException("이미 처리된 requestId입니다: " + requestId);
        }

        UserAccount user = requireUser(userRef);

        Rental rental = rentalRepository.findByUserIdAndStatus(user.getUserId(), Rental.Status.ACTIVE)
                .orElseThrow(() -> new ActiveRentalNotFoundException(
                        "사용자의 활성 대여를 찾을 수 없습니다: " + userRef));

        rental.returning();
        rentalRepository.flush();

        ReturnAttempt returnAttempt;
        try {
            // saveAndFlush로 즉시 INSERT를 실행해야, QoS 1 재전송으로 같은 requestId가
            // 거의 동시에 들어와 UK_RETURN_ATTEMPT_REQUEST_ID를 위반하는 경우를 여기서
            // 바로 잡을 수 있다(RentalCheckoutService와 동일 이유).
            returnAttempt = returnAttemptRepository.saveAndFlush(
                    ReturnAttempt.create(rental.getRentalId(), requestId));
        } catch (DataIntegrityViolationException e) {
            throw new IdempotencyConflictException("동시에 재전송된 requestId입니다: " + requestId);
        }

        return toResult(returnAttempt);
    }

    private UserAccount requireUser(UUID userRef) {
        return userAccountRepository.findByUserRef(userRef)
                .orElseThrow(() -> new UserNotFoundException("userRef로 사용자를 찾을 수 없습니다: " + userRef));
    }

    private ReturnAttemptResponse toResult(ReturnAttempt returnAttempt) {
        return new ReturnAttemptResponse(
                returnAttempt.getReturnAttemptId(),
                returnAttempt.getRentalId(),
                returnAttempt.getStatus().name(),
                returnAttempt.getReturnSlotId());
    }
}
