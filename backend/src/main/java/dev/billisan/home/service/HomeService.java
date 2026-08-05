package dev.billisan.home.service;

import dev.billisan.alert.service.AlertService;
import dev.billisan.global.exception.UserNotFoundException;
import dev.billisan.home.dto.HomeSummaryResponse;
import dev.billisan.rental.RentalOverdueCalculator;
import dev.billisan.rental.domain.Rental;
import dev.billisan.rental.repository.RentalRepository;
import dev.billisan.settlement.domain.Settlement;
import dev.billisan.settlement.repository.SettlementRepository;
import dev.billisan.slot.domain.Slot;
import dev.billisan.slot.repository.SlotRepository;
import dev.billisan.station.domain.Station;
import dev.billisan.station.repository.StationRepository;
import dev.billisan.user.domain.UserAccount;
import dev.billisan.user.repository.UserAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** 12-R HOME-001 — 현재 대여·미정산·알림 수를 서버가 계산해 한 번에 제공한다. */
@Service
@Transactional(readOnly = true)
public class HomeService {

    private static final List<Rental.Status> ACTIVE_STATUSES =
            List.of(Rental.Status.REQUESTED, Rental.Status.ACTIVE, Rental.Status.RETURNING);

    private final UserAccountRepository userAccountRepository;
    private final RentalRepository rentalRepository;
    private final SlotRepository slotRepository;
    private final StationRepository stationRepository;
    private final SettlementRepository settlementRepository;
    private final AlertService alertService;

    public HomeService(
            UserAccountRepository userAccountRepository,
            RentalRepository rentalRepository,
            SlotRepository slotRepository,
            StationRepository stationRepository,
            SettlementRepository settlementRepository,
            AlertService alertService) {
        this.userAccountRepository = userAccountRepository;
        this.rentalRepository = rentalRepository;
        this.slotRepository = slotRepository;
        this.stationRepository = stationRepository;
        this.settlementRepository = settlementRepository;
        this.alertService = alertService;
    }

    public HomeSummaryResponse summary(UUID userRef) {
        UserAccount user = requireUser(userRef);

        HomeSummaryResponse.CurrentRental currentRental = rentalRepository
                .findFirstByUserIdAndStatusInOrderByRequestedAtDesc(user.getUserId(), ACTIVE_STATUSES)
                .map(this::toCurrentRental)
                .orElse(null);

        List<Settlement> pending =
                settlementRepository.findByUserIdAndStatusOrderByCreatedAtDesc(user.getUserId(), Settlement.Status.PENDING);
        long totalAmount = pending.stream()
                .mapToLong(s -> Math.max(s.getAmount() - s.getPaidAmount(), 0))
                .sum();

        int alertCount = alertService.count(userRef);

        return new HomeSummaryResponse(
                new HomeSummaryResponse.UserSummary(user.getName(), UserAccount.SCHOOL_NAME),
                currentRental,
                new HomeSummaryResponse.PendingSettlement(pending.size(), totalAmount),
                alertCount);
    }

    private HomeSummaryResponse.CurrentRental toCurrentRental(Rental rental) {
        LocalDateTime now = LocalDateTime.now();
        String checkoutStationName = slotRepository.findById(rental.getCheckoutSlotId())
                .map(Slot::getStationId)
                .flatMap(stationRepository::findById)
                .map(Station::getName)
                .orElse(null);
        return new HomeSummaryResponse.CurrentRental(
                rental.getRentalId(),
                rental.getStatus(),
                checkoutStationName,
                rental.getRentedAt(),
                rental.getDueAt(),
                RentalOverdueCalculator.isOverdue(rental.getDueAt(), now),
                RentalOverdueCalculator.remainingFreeSeconds(rental.getDueAt(), now));
    }

    private UserAccount requireUser(UUID userRef) {
        return userAccountRepository.findByUserRef(userRef)
                .orElseThrow(() -> new UserNotFoundException("userRef로 사용자를 찾을 수 없습니다: " + userRef));
    }
}
