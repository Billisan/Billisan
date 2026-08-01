package dev.billisan.inspection.service;

import dev.billisan.global.exception.AdminReasonRequiredException;
import dev.billisan.global.exception.InspectionAlreadyDecidedException;
import dev.billisan.global.exception.InspectionConflictException;
import dev.billisan.global.exception.InspectionNotFoundException;
import dev.billisan.global.exception.SlotNotFoundException;
import dev.billisan.inspection.domain.DamageInspection;
import dev.billisan.inspection.domain.DamageInspection.AiResult;
import dev.billisan.inspection.domain.DamageInspection.ReviewStatus;
import dev.billisan.inspection.dto.InspectionDecisionRequest;
import dev.billisan.inspection.dto.InspectionDecisionResult;
import dev.billisan.inspection.dto.InspectionDetailResponse;
import dev.billisan.inspection.dto.InspectionPageResponse;
import dev.billisan.inspection.dto.InspectionSummaryResponse;
import dev.billisan.inspection.repository.DamageInspectionRepository;
import dev.billisan.rental.domain.Rental;
import dev.billisan.rental.repository.RentalRepository;
import dev.billisan.returns.domain.ReturnAttempt;
import dev.billisan.returns.repository.ReturnAttemptRepository;
import dev.billisan.settlement.domain.Settlement;
import dev.billisan.settlement.repository.SettlementRepository;
import dev.billisan.slot.domain.Slot;
import dev.billisan.slot.domain.Slot.ItemCondition;
import dev.billisan.slot.domain.Slot.ServiceStatus;
import dev.billisan.slot.repository.SlotRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class InspectionAdminService {

    private final DamageInspectionRepository damageInspectionRepository;
    private final SlotRepository slotRepository;
    private final ReturnAttemptRepository returnAttemptRepository;
    private final RentalRepository rentalRepository;
    private final SettlementRepository settlementRepository;

    public InspectionAdminService(
            DamageInspectionRepository damageInspectionRepository,
            SlotRepository slotRepository,
            ReturnAttemptRepository returnAttemptRepository,
            RentalRepository rentalRepository,
            SettlementRepository settlementRepository) {
        this.damageInspectionRepository = damageInspectionRepository;
        this.slotRepository = slotRepository;
        this.returnAttemptRepository = returnAttemptRepository;
        this.rentalRepository = rentalRepository;
        this.settlementRepository = settlementRepository;
    }

    public InspectionPageResponse list(
            AiResult aiResult,
            ReviewStatus reviewStatus,
            String modelVersion,
            LocalDateTime from,
            LocalDateTime to,
            String cursor,
            int size) {
        InspectionCursor position = InspectionCursor.decode(cursor);
        Specification<DamageInspection> filters = buildFilters(aiResult, modelVersion, from, to);

        List<InspectionSummaryResponse> items = new ArrayList<>();
        String nextCursor = null;

        if (matchesGroup(reviewStatus, ReviewStatus.PENDING) && items.size() < size) {
            int offset = position.groupOffset(ReviewStatus.PENDING);
            List<DamageInspection> pending = fetchGroup(filters, ReviewStatus.PENDING, offset, size - items.size());
            items.addAll(pending.stream().map(InspectionSummaryResponse::of).toList());
            // 페이지가 꽉 찼다는 건 PENDING 그룹에 더 남아있을 수 있다는 뜻(단순화된 오프셋
            // 커서라 정확한 총량은 모름) — 그 경우에만 PENDING 계속용 커서를 내려준다.
            if (items.size() == size) {
                nextCursor = InspectionCursor.of(ReviewStatus.PENDING, offset + pending.size()).encode();
            }
        }

        if (matchesGroup(reviewStatus, ReviewStatus.DECIDED) && items.size() < size) {
            int offset = position.group() == ReviewStatus.DECIDED ? position.offset() : 0;
            List<DamageInspection> decided = fetchGroup(filters, ReviewStatus.DECIDED, offset, size - items.size());
            items.addAll(decided.stream().map(InspectionSummaryResponse::of).toList());
            if (items.size() == size && !decided.isEmpty()) {
                nextCursor = InspectionCursor.of(ReviewStatus.DECIDED, offset + decided.size()).encode();
            }
        }

        return new InspectionPageResponse(items, nextCursor);
    }

    public InspectionDetailResponse getDetail(UUID inspectionId) {
        DamageInspection inspection = requireInspection(inspectionId);
        ReturnAttempt returnAttempt = requireReturnAttempt(inspection.getReturnAttemptId());
        Slot slot = requireSlot(returnAttempt.getReturnSlotId());
        return InspectionDetailResponse.of(inspection, slot);
    }

    @Transactional
    public InspectionDecisionResult decide(UUID inspectionId, UUID reviewedBy, InspectionDecisionRequest request) {
        if (request.reasonCode() == null || request.reasonCode().isBlank()) {
            throw new AdminReasonRequiredException("reasonCode는 필수입니다.");
        }

        DamageInspection inspection = requireInspection(inspectionId);

        if (!inspection.getUpdatedAt().equals(request.expectedUpdatedAt())) {
            throw new InspectionConflictException(
                    "검수가 그 사이에 변경됐습니다. 최신 상태를 다시 조회한 뒤 재시도하세요: " + inspectionId);
        }
        if (inspection.isReviewed()) {
            throw new InspectionAlreadyDecidedException("이미 확정된 검수는 다시 판정할 수 없습니다: " + inspectionId);
        }

        ReturnAttempt returnAttempt = requireReturnAttempt(inspection.getReturnAttemptId());
        Slot slot = requireSlot(returnAttempt.getReturnSlotId());

        switch (request.decision()) {
            case NORMAL -> applyNormal(inspection, slot, reviewedBy);
            case DAMAGED -> applyDamaged(inspection, slot, reviewedBy);
            case KEEP_ADMIN_REVIEW -> { /* 검수 PENDING·슬롯 ADMIN_REVIEW 그대로, 정산 없음 */ }
        }

        // 같은 트랜잭션의 EntityManager를 공유하므로 이 호출 하나로 inspection·slot·
        // settlement 변경이 전부 flush된다(@PreUpdate는 flush 시점에만 실행).
        damageInspectionRepository.flush();

        Settlement settlement = settlementRepository.findByRentalId(inspection.getRentalId()).orElse(null);
        return InspectionDecisionResult.of(inspection, slot, settlement);
    }

    private void applyNormal(DamageInspection inspection, Slot slot, UUID reviewedBy) {
        inspection.review(DamageInspection.Decision.NORMAL, reviewedBy);
        slot.applyAdminStatus(ServiceStatus.AVAILABLE, ItemCondition.NORMAL);
    }

    private void applyDamaged(DamageInspection inspection, Slot slot, UUID reviewedBy) {
        inspection.review(DamageInspection.Decision.DAMAGED, reviewedBy);
        slot.applyAdminStatus(ServiceStatus.OUT_OF_SERVICE, ItemCondition.DAMAGED);

        // ★ 실기 테스트로 발견: settlement.damage_inspection_id가 참조하는 실제 FK는
        // (damage_inspection_id, rental_id, damage_basis_guard) 복합 FK이고, 상대편
        // damage_inspection.settlement_eligible_guard는 admin_decision=DAMAGED +
        // reviewed_by/reviewed_at이 채워져야 1이 되는 생성 컬럼이다. Hibernate 기본 flush
        // 순서는 INSERT를 UPDATE보다 먼저 내보내므로, 여기서 명시적으로 flush하지 않으면
        // 방금 위에서 review()한 inspection의 UPDATE가 DB에 반영되기 전에 아래 settlement
        // INSERT/UPDATE가 나가 FK_SETTLEMENT_DAMAGE_INSPECTION 위반으로 거부된다.
        damageInspectionRepository.flush();

        // rental_id는 damage_inspection에 직접 있다(V14) — return_attempt를 다시 거치지
        // 않아도 된다. 다만 정산엔 user_id가 필요해 Rental 조회는 여전히 한다.
        Rental rental = rentalRepository.findById(inspection.getRentalId())
                .orElseThrow(() -> new IllegalStateException(
                        "검수에 연결된 대여를 찾을 수 없습니다(데이터 정합성 문제): " + inspection.getRentalId()));

        settlementRepository.findByRentalId(rental.getRentalId())
                .ifPresentOrElse(
                        settlement -> settlement.applyDamage(inspection.getInspectionId()),
                        () -> settlementRepository.save(Settlement.createForDamage(
                                rental.getUserId(), rental.getRentalId(), inspection.getInspectionId())));
    }

    private DamageInspection requireInspection(UUID inspectionId) {
        return damageInspectionRepository.findById(inspectionId)
                .orElseThrow(() -> new InspectionNotFoundException("검수를 찾을 수 없습니다: " + inspectionId));
    }

    private ReturnAttempt requireReturnAttempt(UUID returnAttemptId) {
        return returnAttemptRepository.findById(returnAttemptId)
                .orElseThrow(() -> new IllegalStateException(
                        "검수에 연결된 반납 시도를 찾을 수 없습니다(데이터 정합성 문제): " + returnAttemptId));
    }

    private Slot requireSlot(UUID slotId) {
        return slotRepository.findById(slotId)
                .orElseThrow(() -> new SlotNotFoundException("슬롯을 찾을 수 없습니다: " + slotId));
    }

    private boolean matchesGroup(ReviewStatus requestedFilter, ReviewStatus group) {
        return requestedFilter == null || requestedFilter == group;
    }

    private List<DamageInspection> fetchGroup(
            Specification<DamageInspection> filters, ReviewStatus group, int offset, int limit) {
        if (limit <= 0) {
            return List.of();
        }
        Specification<DamageInspection> spec = filters.and(
                (root, query, cb) -> group == ReviewStatus.PENDING
                        ? cb.isNull(root.get("reviewedBy"))
                        : cb.isNotNull(root.get("reviewedBy")));
        return damageInspectionRepository.findAll(
                spec,
                PageRequest.of(offset / Math.max(limit, 1), limit)
        ).getContent();
    }

    private Specification<DamageInspection> buildFilters(
            AiResult aiResult, String modelVersion, LocalDateTime from, LocalDateTime to) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (aiResult != null) {
                predicates.add(cb.equal(root.get("aiResult"), aiResult));
            }
            if (modelVersion != null && !modelVersion.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("modelVersion")), "%" + modelVersion.toLowerCase() + "%"));
            }
            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("completedAt"), from));
            }
            if (to != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("completedAt"), to));
            }
            if (query != null) {
                query.orderBy(cb.desc(root.get("completedAt")));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    /** ⚠️ 초안 단순화 — InspectionPageResponse Javadoc 참조. */
    private record InspectionCursor(ReviewStatus group, int offset) {

        static InspectionCursor decode(String cursor) {
            if (cursor == null || cursor.isBlank()) {
                return new InspectionCursor(ReviewStatus.PENDING, 0);
            }
            String decoded = new String(Base64.getDecoder().decode(cursor), StandardCharsets.UTF_8);
            String[] parts = decoded.split(":", 2);
            return new InspectionCursor(ReviewStatus.valueOf(parts[0]), Integer.parseInt(parts[1]));
        }

        static InspectionCursor of(ReviewStatus group, int offset) {
            return new InspectionCursor(group, offset);
        }

        int groupOffset(ReviewStatus targetGroup) {
            return group == targetGroup ? offset : 0;
        }

        String encode() {
            String raw = group.name() + ":" + offset;
            return Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
        }
    }
}
