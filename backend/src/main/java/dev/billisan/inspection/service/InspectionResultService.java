package dev.billisan.inspection.service;

import dev.billisan.global.exception.IdempotencyConflictException;
import dev.billisan.global.exception.ReturnAttemptNotFoundException;
import dev.billisan.inspection.domain.DamageInspection;
import dev.billisan.inspection.domain.DamageInspection.AiResult;
import dev.billisan.inspection.domain.DamageInspection.ProcessStatus;
import dev.billisan.inspection.dto.InspectionResultRequest;
import dev.billisan.inspection.dto.InspectionResultResponse;
import dev.billisan.inspection.repository.DamageInspectionRepository;
import dev.billisan.returns.domain.ReturnAttempt;
import dev.billisan.returns.repository.ReturnAttemptRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** EDGE-INSPECT-001 — 이미지 없는 Orin 검수 메타데이터를 저장한다. */
@Service
public class InspectionResultService {

    private final ReturnAttemptRepository returnAttemptRepository;
    private final DamageInspectionRepository damageInspectionRepository;

    public InspectionResultService(
            ReturnAttemptRepository returnAttemptRepository,
            DamageInspectionRepository damageInspectionRepository) {
        this.returnAttemptRepository = returnAttemptRepository;
        this.damageInspectionRepository = damageInspectionRepository;
    }

    /**
     * return_attempt_id당 검수는 정확히 1건만 허용된다(UK_DAMAGE_INSPECTION_RETURN_ATTEMPT_ID)
     * — 이미 있으면 재전송으로 보고 새로 만들지 않는다.
     */
    @Transactional
    public InspectionResultResponse recordResult(InspectionResultRequest request) {
        if (damageInspectionRepository
                .findFirstByReturnAttemptIdOrderByCreatedAtDesc(request.returnAttemptId())
                .isPresent()) {
            throw new IdempotencyConflictException(
                    "이미 검수 결과가 저장된 returnAttemptId입니다: " + request.returnAttemptId());
        }

        ReturnAttempt returnAttempt = returnAttemptRepository.findById(request.returnAttemptId())
                .orElseThrow(() -> new ReturnAttemptNotFoundException(
                        "returnAttemptId로 반납 시도를 찾을 수 없습니다: " + request.returnAttemptId()));

        ProcessStatus status = ProcessStatus.valueOf(request.processStatus().name());
        AiResult aiResult = request.result() == InspectionResultRequest.Result.FAILED
                ? null
                : AiResult.valueOf(request.result().name());

        DamageInspection inspection;
        try {
            // saveAndFlush로 즉시 INSERT를 실행해야, QoS 1 재전송으로 같은 returnAttemptId가
            // 거의 동시에 들어와 UK_DAMAGE_INSPECTION_RETURN_ATTEMPT_ID를 위반하는 경우를
            // 여기서 바로 잡을 수 있다(ReturnAttemptService와 동일 이유).
            inspection = damageInspectionRepository.saveAndFlush(DamageInspection.create(
                    returnAttempt.getReturnAttemptId(),
                    returnAttempt.getRentalId(),
                    request.inspectionRequestId().toString(),
                    status,
                    aiResult,
                    request.confidence(),
                    request.modelVersion()));
        } catch (DataIntegrityViolationException e) {
            throw new IdempotencyConflictException(
                    "동시에 재전송된 검수 결과입니다: returnAttemptId=" + request.returnAttemptId());
        }

        return toResult(request, inspection);
    }

    private InspectionResultResponse toResult(InspectionResultRequest request, DamageInspection inspection) {
        boolean reviewRequired = inspection.requiresReview();
        String storedResult = inspection.getAiResult() == null ? "FAILED" : inspection.getAiResult().name();
        String slotServiceStatus = reviewRequired ? "ADMIN_REVIEW" : null;
        return new InspectionResultResponse(
                request.inspectionRequestId(),
                request.returnAttemptId(),
                storedResult,
                reviewRequired,
                slotServiceStatus,
                inspection.getUpdatedAt());
    }
}
