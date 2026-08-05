package dev.billisan.alert.service;

import dev.billisan.alert.dto.AlertListResponse;
import dev.billisan.global.exception.UserNotFoundException;
import dev.billisan.inspection.domain.DamageInspection;
import dev.billisan.inspection.repository.DamageInspectionRepository;
import dev.billisan.returns.domain.ReturnAttempt;
import dev.billisan.returns.repository.ReturnAttemptRepository;
import dev.billisan.settlement.domain.Settlement;
import dev.billisan.settlement.repository.SettlementRepository;
import dev.billisan.user.domain.UserAccount;
import dev.billisan.user.repository.UserAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * 12-R ALERT-001(`PROVISIONAL_API`) — 영속 알림 테이블 없이 현재 도메인 상태에서 파생한다.
 * {@code RENTAL_DUE_SOON}·{@code RETURN_COMPLETED}는 알림 임계값(몇 시간 전부터, 반납 후
 * 몇 시간까지)이 정책적으로 미확정이라(CLAUDE.md DEC-POL-001류) 이번 구현에서는 값이 명확한
 * {@code UNSETTLED}·{@code RECOVERY_REQUIRED}·{@code ADMIN_REVIEW} 3종만 파생한다.
 */
@Service
@Transactional(readOnly = true)
public class AlertService {

    private final UserAccountRepository userAccountRepository;
    private final SettlementRepository settlementRepository;
    private final ReturnAttemptRepository returnAttemptRepository;
    private final DamageInspectionRepository damageInspectionRepository;

    public AlertService(
            UserAccountRepository userAccountRepository,
            SettlementRepository settlementRepository,
            ReturnAttemptRepository returnAttemptRepository,
            DamageInspectionRepository damageInspectionRepository) {
        this.userAccountRepository = userAccountRepository;
        this.settlementRepository = settlementRepository;
        this.returnAttemptRepository = returnAttemptRepository;
        this.damageInspectionRepository = damageInspectionRepository;
    }

    public AlertListResponse list(UUID userRef) {
        UserAccount user = requireUser(userRef);
        return new AlertListResponse(deriveAlerts(user.getUserId()));
    }

    /** HOME-001의 {@code alertCount} — 목록을 다시 만들지 않고 개수만 필요할 때. */
    public int count(UUID userRef) {
        UserAccount user = requireUser(userRef);
        return deriveAlerts(user.getUserId()).size();
    }

    private List<AlertListResponse.Item> deriveAlerts(String userId) {
        List<AlertListResponse.Item> alerts = new ArrayList<>();

        settlementRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, Settlement.Status.PENDING).stream()
                .filter(settlement -> settlement.getAmount() - settlement.getPaidAmount() > 0)
                .map(AlertListResponse.Item::unsettled)
                .forEach(alerts::add);

        returnAttemptRepository.findByUserIdAndStatus(userId, ReturnAttempt.Status.RECOVERY_REQUIRED).stream()
                .map(AlertListResponse.Item::recoveryRequired)
                .forEach(alerts::add);

        damageInspectionRepository.findRequiringReviewByUserId(userId, DamageInspection.AiResult.NORMAL).stream()
                .map(AlertListResponse.Item::adminReview)
                .forEach(alerts::add);

        alerts.sort(Comparator.comparing(AlertListResponse.Item::occurredAt).reversed());
        return alerts;
    }

    private UserAccount requireUser(UUID userRef) {
        return userAccountRepository.findByUserRef(userRef)
                .orElseThrow(() -> new UserNotFoundException("userRef로 사용자를 찾을 수 없습니다: " + userRef));
    }
}
