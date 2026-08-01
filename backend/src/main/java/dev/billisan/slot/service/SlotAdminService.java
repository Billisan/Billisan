package dev.billisan.slot.service;

import dev.billisan.global.exception.AdminReasonRequiredException;
import dev.billisan.global.exception.InvalidSlotStatusTransitionException;
import dev.billisan.global.exception.SlotNotFoundException;
import dev.billisan.global.exception.SlotStatusConflictException;
import dev.billisan.global.exception.StationNotFoundException;
import dev.billisan.inspection.repository.DamageInspectionRepository;
import dev.billisan.returns.domain.ReturnAttempt;
import dev.billisan.returns.repository.ReturnAttemptRepository;
import dev.billisan.slot.domain.Slot;
import dev.billisan.slot.domain.Slot.ItemCondition;
import dev.billisan.slot.domain.Slot.LockStatus;
import dev.billisan.slot.domain.Slot.OccupancyStatus;
import dev.billisan.slot.domain.Slot.ServiceStatus;
import dev.billisan.slot.dto.LatestInspectionView;
import dev.billisan.slot.dto.LatestReturnAttemptView;
import dev.billisan.slot.dto.SlotDetailResponse;
import dev.billisan.slot.dto.SlotInventoryResponse;
import dev.billisan.slot.dto.SlotListResponse;
import dev.billisan.slot.dto.SlotStatusUpdateRequest;
import dev.billisan.slot.dto.SlotSummaryResponse;
import dev.billisan.slot.repository.SlotRepository;
import dev.billisan.station.repository.StationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class SlotAdminService {

    private final StationRepository stationRepository;
    private final SlotRepository slotRepository;
    private final ReturnAttemptRepository returnAttemptRepository;
    private final DamageInspectionRepository damageInspectionRepository;

    public SlotAdminService(
            StationRepository stationRepository,
            SlotRepository slotRepository,
            ReturnAttemptRepository returnAttemptRepository,
            DamageInspectionRepository damageInspectionRepository) {
        this.stationRepository = stationRepository;
        this.slotRepository = slotRepository;
        this.returnAttemptRepository = returnAttemptRepository;
        this.damageInspectionRepository = damageInspectionRepository;
    }

    public SlotInventoryResponse getInventory(UUID stationId) {
        requireStation(stationId);

        long total = slotRepository.countByStationId(stationId);
        long occupied = slotRepository.countByStationIdAndOccupancyStatus(stationId, OccupancyStatus.OCCUPIED);
        long empty = slotRepository.countByStationIdAndOccupancyStatus(stationId, OccupancyStatus.EMPTY);
        long unknownOccupancy = slotRepository.countByStationIdAndOccupancyStatus(stationId, OccupancyStatus.UNKNOWN);
        long adminReview = slotRepository.countByStationIdAndServiceStatus(stationId, ServiceStatus.ADMIN_REVIEW);
        long outOfService = slotRepository.countByStationIdAndServiceStatus(stationId, ServiceStatus.OUT_OF_SERVICE);
        long damaged = slotRepository.countByStationIdAndItemCondition(stationId, ItemCondition.DAMAGED);
        long availableUmbrella = slotRepository.countByStationIdAndServiceStatusAndOccupancyStatusAndLockStatusAndItemCondition(
                stationId, ServiceStatus.AVAILABLE, OccupancyStatus.OCCUPIED, LockStatus.LOCKED, ItemCondition.NORMAL);

        return new SlotInventoryResponse(
                stationId, total, occupied, empty, unknownOccupancy, availableUmbrella, adminReview, outOfService,
                damaged, LocalDateTime.now());
    }

    public SlotListResponse listSlots(UUID stationId) {
        requireStation(stationId);
        List<SlotSummaryResponse> items = slotRepository.findByStationIdOrderBySlotNumber(stationId).stream()
                .map(SlotSummaryResponse::of)
                .collect(Collectors.toList());
        return new SlotListResponse(stationId, items);
    }

    public SlotDetailResponse getSlotDetail(UUID slotId) {
        Slot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new SlotNotFoundException("슬롯을 찾을 수 없습니다: " + slotId));

        // damage_inspection엔 slot_id가 없다(DamageInspection Javadoc 참조) — return_attempt를
        // 먼저 찾아 그 id로 최신 검수를 조회한다. 같은 return_attempt를 두 번 조회하지 않도록
        // 여기서 한 번만 가져와 재사용한다.
        Optional<ReturnAttempt> latestReturnAttemptEntity = returnAttemptRepository
                .findFirstByReturnSlotIdOrderByCreatedAtDesc(slotId);

        LatestReturnAttemptView latestReturnAttempt = latestReturnAttemptEntity
                .map(LatestReturnAttemptView::of)
                .orElse(null);

        LatestInspectionView latestInspection = latestReturnAttemptEntity
                .flatMap(ra -> damageInspectionRepository
                        .findFirstByReturnAttemptIdOrderByCreatedAtDesc(ra.getReturnAttemptId()))
                .map(LatestInspectionView::of)
                .orElse(null);

        return SlotDetailResponse.of(slot, latestReturnAttempt, latestInspection);
    }

    @Transactional
    public SlotSummaryResponse updateStatus(UUID slotId, UUID adminId, SlotStatusUpdateRequest request) {
        if (request.reasonCode() == null || request.reasonCode().isBlank()) {
            throw new AdminReasonRequiredException("reasonCode는 필수입니다.");
        }

        // findById(비잠금)이면 두 요청이 같은 updatedAt을 동시에 읽고 CAS를 통과해 lost
        // update가 날 수 있다(리뷰로 발견) — 조회 시점에 행을 잠가 뒤 트랜잭션을 대기시킨다.
        Slot slot = slotRepository.findByIdForUpdate(slotId)
                .orElseThrow(() -> new SlotNotFoundException("슬롯을 찾을 수 없습니다: " + slotId));

        if (!slot.getUpdatedAt().equals(request.expectedUpdatedAt())) {
            throw new SlotStatusConflictException(
                    "슬롯이 그 사이에 변경됐습니다. 최신 상태를 다시 조회한 뒤 재시도하세요: " + slotId);
        }

        if (!Slot.isValidAdminCombination(request.targetServiceStatus(), request.targetItemCondition())) {
            throw new InvalidSlotStatusTransitionException(
                    "허용되지 않는 조합입니다: " + request.targetServiceStatus() + "+" + request.targetItemCondition());
        }

        slot.applyAdminStatus(request.targetServiceStatus(), request.targetItemCondition());
        // @PreUpdate는 flush 시점에만 실행되므로, flush 없이 바로 응답을 만들면 updatedAt이
        // 갱신 전 값 그대로 나간다 — 클라이언트가 이 응답의 updatedAt으로 바로 다음 CAS
        // 요청을 보내면 서버 실제 값과 달라 엉뚱하게 409가 난다. 명시적 flush로 @PreUpdate를
        // 지금 실행시켜 응답에 새 값을 담는다.
        slotRepository.flush();
        return SlotSummaryResponse.of(slot, adminId);
    }

    private void requireStation(UUID stationId) {
        if (!stationRepository.existsById(stationId)) {
            throw new StationNotFoundException("대여소를 찾을 수 없습니다: " + stationId);
        }
    }
}
