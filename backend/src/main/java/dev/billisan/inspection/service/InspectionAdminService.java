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
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

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

        List<DamageInspection> inspections = new ArrayList<>();
        String nextCursor = null;

        if (matchesGroup(reviewStatus, ReviewStatus.PENDING) && inspections.size() < size) {
            int offset = position.groupOffset(ReviewStatus.PENDING);
            List<DamageInspection> pending = fetchGroup(filters, ReviewStatus.PENDING, offset, size - inspections.size());
            inspections.addAll(pending);
            // 페이지가 꽉 찼다는 건 PENDING 그룹에 더 남아있을 수 있다는 뜻(단순화된 오프셋
            // 커서라 정확한 총량은 모름) — 그 경우에만 PENDING 계속용 커서를 내려준다.
            if (inspections.size() == size) {
                nextCursor = InspectionCursor.of(ReviewStatus.PENDING, offset + pending.size()).encode();
            }
        }

        if (matchesGroup(reviewStatus, ReviewStatus.DECIDED) && inspections.size() < size) {
            int offset = position.group() == ReviewStatus.DECIDED ? position.offset() : 0;
            List<DamageInspection> decided = fetchGroup(filters, ReviewStatus.DECIDED, offset, size - inspections.size());
            inspections.addAll(decided);
            if (inspections.size() == size && !decided.isEmpty()) {
                nextCursor = InspectionCursor.of(ReviewStatus.DECIDED, offset + decided.size()).encode();
            }
        }

        return new InspectionPageResponse(toSummaries(inspections), nextCursor);
    }

    /**
     * damage_inspection엔 station_id·slot_id가 없어 return_attempt→slot을 거쳐야 하는데,
     * 행마다 조회하면 N+1이 된다 — 페이지 전체를 배치 2쿼리로 한 번에 매핑한다.
     */
    private List<InspectionSummaryResponse> toSummaries(List<DamageInspection> inspections) {
        List<UUID> returnAttemptIds = inspections.stream()
                .map(DamageInspection::getReturnAttemptId)
                .distinct()
                .toList();
        Map<UUID, ReturnAttempt> returnAttemptsById = returnAttemptRepository.findAllById(returnAttemptIds).stream()
                .collect(Collectors.toMap(ReturnAttempt::getReturnAttemptId, ra -> ra));

        List<UUID> slotIds = returnAttemptsById.values().stream()
                .map(ReturnAttempt::getReturnSlotId)
                .filter(slotId -> slotId != null)
                .distinct()
                .toList();
        Map<UUID, Slot> slotsById = slotRepository.findAllById(slotIds).stream()
                .collect(Collectors.toMap(Slot::getSlotId, s -> s));

        return inspections.stream()
                .map(inspection -> {
                    ReturnAttempt returnAttempt = returnAttemptsById.get(inspection.getReturnAttemptId());
                    Slot slot = returnAttempt == null ? null : slotsById.get(returnAttempt.getReturnSlotId());
                    return InspectionSummaryResponse.of(
                            inspection,
                            slot == null ? null : slot.getStationId(),
                            slot == null ? null : slot.getSlotId());
                })
                .toList();
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

        // 파손 정산만 노출한다 — DAMAGED가 아니면 이 대여에 이미 있을 수 있는 연체 정산 등
        // 무관한 정산을 settlement로 잘못 보여주지 않는다.
        Settlement settlement = request.decision() == InspectionDecisionRequest.DecisionType.DAMAGED
                ? settlementRepository.findByRentalId(inspection.getRentalId()).orElse(null)
                : null;
        return InspectionDecisionResult.of(inspection, request.decision().name(), slot, settlement);
    }

    private void applyNormal(DamageInspection inspection, Slot slot, UUID reviewedBy) {
        inspection.review(DamageInspection.Decision.NORMAL, reviewedBy);
        slot.applyAdminStatus(ServiceStatus.AVAILABLE, ItemCondition.NORMAL);
    }

    private void applyDamaged(DamageInspection inspection, Slot slot, UUID reviewedBy) {
        inspection.review(DamageInspection.Decision.DAMAGED, reviewedBy);
        slot.applyAdminStatus(ServiceStatus.OUT_OF_SERVICE, ItemCondition.DAMAGED);

        // settlement의 FK가 damage_inspection.settlement_eligible_guard(생성 컬럼, DAMAGED+
        // reviewed_by/at 필요)를 참조한다. Hibernate가 INSERT를 UPDATE보다 먼저 내보내므로,
        // 여기서 flush 안 하면 위 review()가 반영되기 전에 settlement가 나가 FK 위반이 난다.
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
