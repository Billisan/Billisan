package dev.billisan.rental.service;

import dev.billisan.global.exception.InvalidRequestException;
import dev.billisan.global.exception.UserNotFoundException;
import dev.billisan.global.paging.OffsetCursor;
import dev.billisan.global.paging.OffsetPageRequest;
import dev.billisan.rental.RentalOverdueCalculator;
import dev.billisan.rental.domain.Rental;
import dev.billisan.rental.dto.RentalCurrentResponse;
import dev.billisan.rental.dto.RentalHistoryResponse;
import dev.billisan.rental.repository.RentalRepository;
import dev.billisan.returns.domain.ReturnAttempt;
import dev.billisan.returns.repository.ReturnAttemptRepository;
import dev.billisan.settlement.domain.Settlement;
import dev.billisan.settlement.repository.SettlementRepository;
import dev.billisan.slot.domain.Slot;
import dev.billisan.slot.repository.SlotRepository;
import dev.billisan.station.domain.Station;
import dev.billisan.station.repository.StationRepository;
import dev.billisan.user.domain.UserAccount;
import dev.billisan.user.repository.UserAccountRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

/** 12-R RENTAL-001·RENTAL-002 — 인증 사용자 본인의 대여 조회 전용. 상태 변경은 이 서비스 범위 밖이다. */
@Service
@Transactional(readOnly = true)
public class RentalAppService {

    private static final List<Rental.Status> ACTIVE_STATUSES =
            List.of(Rental.Status.REQUESTED, Rental.Status.ACTIVE, Rental.Status.RETURNING);

    private final UserAccountRepository userAccountRepository;
    private final RentalRepository rentalRepository;
    private final SlotRepository slotRepository;
    private final StationRepository stationRepository;
    private final ReturnAttemptRepository returnAttemptRepository;
    private final SettlementRepository settlementRepository;

    public RentalAppService(
            UserAccountRepository userAccountRepository,
            RentalRepository rentalRepository,
            SlotRepository slotRepository,
            StationRepository stationRepository,
            ReturnAttemptRepository returnAttemptRepository,
            SettlementRepository settlementRepository) {
        this.userAccountRepository = userAccountRepository;
        this.rentalRepository = rentalRepository;
        this.slotRepository = slotRepository;
        this.stationRepository = stationRepository;
        this.returnAttemptRepository = returnAttemptRepository;
        this.settlementRepository = settlementRepository;
    }

    public RentalCurrentResponse current(UUID userRef) {
        UserAccount user = requireUser(userRef);
        Rental rental = rentalRepository
                .findFirstByUserIdAndStatusInOrderByRequestedAtDesc(user.getUserId(), ACTIVE_STATUSES)
                .orElse(null);
        if (rental == null) {
            return null;
        }

        Slot checkoutSlot = requireSlot(rental.getCheckoutSlotId());
        Station checkoutStation = requireStation(checkoutSlot.getStationId());
        ReturnAttempt latestReturnAttempt = returnAttemptRepository
                .findFirstByRentalIdOrderByCreatedAtDesc(rental.getRentalId())
                .orElse(null);
        Slot returnSlot = latestReturnAttempt != null && latestReturnAttempt.getReturnSlotId() != null
                ? slotRepository.findById(latestReturnAttempt.getReturnSlotId()).orElse(null)
                : null;

        LocalDateTime now = LocalDateTime.now();
        int overdueDays = RentalOverdueCalculator.overdueDays(rental.getDueAt(), now);
        long calculatedOverdueAmount = RentalOverdueCalculator.overdueFee(overdueDays);

        return RentalCurrentResponse.of(
                rental, checkoutSlot, checkoutStation, latestReturnAttempt, returnSlot, overdueDays, calculatedOverdueAmount);
    }

    public RentalHistoryResponse history(UUID userRef, String status, String cursor, int size) {
        UserAccount user = requireUser(userRef);
        int boundedSize = Math.max(1, Math.min(size, 100));
        int offset = OffsetCursor.decode(cursor);

        Specification<Rental> spec = buildFilter(user.getUserId(), status);
        List<Rental> rentals = rentalRepository.findAll(spec, new OffsetPageRequest(offset, boundedSize)).getContent();

        String nextCursor = rentals.size() == boundedSize ? OffsetCursor.encode(offset + rentals.size()) : null;
        return new RentalHistoryResponse(toItems(rentals), nextCursor);
    }

    private Specification<Rental> buildFilter(String userId, String status) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("userId"), userId));
            if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                predicates.add(cb.equal(root.get("status"), parseStatus(status)));
            }
            if (query != null) {
                query.orderBy(cb.desc(root.get("requestedAt")));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    /**
     * 목록 항목은 대여소명·정산액을 배치 2~4쿼리로 한 번에 매핑한다(N+1 방지) —
     * {@code InspectionAdminService.toSummaries}와 같은 원칙. 연결된 슬롯·대여소가 없는
     * 항목은 (데이터 정합성이 깨진 경우가 아니라면 발생하지 않지만) 목록 조회 특성상
     * 예외를 던지지 않고 이름을 {@code null}로 남긴다.
     */
    private List<RentalHistoryResponse.Item> toItems(List<Rental> rentals) {
        if (rentals.isEmpty()) {
            return List.of();
        }

        List<UUID> rentalIds = rentals.stream().map(Rental::getRentalId).toList();

        List<UUID> checkoutSlotIds = rentals.stream().map(Rental::getCheckoutSlotId).distinct().toList();
        Map<UUID, Slot> checkoutSlotsById = slotRepository.findAllById(checkoutSlotIds).stream()
                .collect(Collectors.toMap(Slot::getSlotId, s -> s));

        List<ReturnAttempt> completedReturns =
                returnAttemptRepository.findByRentalIdInAndStatus(rentalIds, ReturnAttempt.Status.COMPLETED);
        Map<UUID, ReturnAttempt> completedReturnByRentalId = completedReturns.stream()
                .collect(Collectors.toMap(ReturnAttempt::getRentalId, ra -> ra));

        Map<UUID, Slot> returnSlotsById = slotRepository.findAllById(
                        completedReturns.stream().map(ReturnAttempt::getReturnSlotId).filter(Objects::nonNull).distinct().toList())
                .stream()
                .collect(Collectors.toMap(Slot::getSlotId, s -> s));

        List<UUID> stationIds = new ArrayList<>(checkoutSlotsById.values().stream().map(Slot::getStationId).distinct().toList());
        returnSlotsById.values().stream().map(Slot::getStationId).distinct().forEach(stationIds::add);
        Map<UUID, Station> stationsById = stationRepository.findAllById(stationIds.stream().distinct().toList()).stream()
                .collect(Collectors.toMap(Station::getStationId, s -> s));

        Map<UUID, Settlement> settlementsByRentalId = settlementRepository.findByRentalIdIn(rentalIds).stream()
                .collect(Collectors.toMap(Settlement::getRentalId, s -> s));

        return rentals.stream()
                .map(rental -> {
                    String checkoutStationName = stationName(checkoutSlotsById.get(rental.getCheckoutSlotId()), stationsById);
                    ReturnAttempt completedReturn = completedReturnByRentalId.get(rental.getRentalId());
                    String returnStationName = completedReturn == null
                            ? null
                            : stationName(returnSlotsById.get(completedReturn.getReturnSlotId()), stationsById);
                    Settlement settlement = settlementsByRentalId.get(rental.getRentalId());
                    return RentalHistoryResponse.Item.of(rental, checkoutStationName, returnStationName, settlement);
                })
                .toList();
    }

    private static String stationName(Slot slot, Map<UUID, Station> stationsById) {
        if (slot == null) {
            return null;
        }
        Station station = stationsById.get(slot.getStationId());
        return station == null ? null : station.getName();
    }

    private static Rental.Status parseStatus(String status) {
        try {
            return Rental.Status.valueOf(status);
        } catch (IllegalArgumentException e) {
            throw new InvalidRequestException("올바르지 않은 status 값입니다: " + status);
        }
    }

    private Slot requireSlot(UUID slotId) {
        return slotRepository.findById(slotId)
                .orElseThrow(() -> new IllegalStateException("대여의 슬롯을 찾을 수 없습니다(데이터 정합성 문제): " + slotId));
    }

    private Station requireStation(UUID stationId) {
        return stationRepository.findById(stationId)
                .orElseThrow(() -> new IllegalStateException("슬롯의 대여소를 찾을 수 없습니다(데이터 정합성 문제): " + stationId));
    }

    private UserAccount requireUser(UUID userRef) {
        return userAccountRepository.findByUserRef(userRef)
                .orElseThrow(() -> new UserNotFoundException("userRef로 사용자를 찾을 수 없습니다: " + userRef));
    }
}
