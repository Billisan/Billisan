package dev.billisan.user.service;

import dev.billisan.user.domain.UserAccount;
import dev.billisan.user.repository.UserAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RentalEligibilityService {

    private final UserAccountRepository userAccountRepository;

    public RentalEligibilityService(UserAccountRepository userAccountRepository) {
        this.userAccountRepository = userAccountRepository;
    }

    /**
     * Recalculates the read projection from authoritative user-level facts.
     * Rental creation must still validate current facts and DB constraints because
     * station availability and infrastructure health are separate runtime concerns.
     */
    @Transactional
    public boolean refresh(String userId) {
        UserAccount user = userAccountRepository.findByIdForEligibilityUpdate(userId)
                .orElseThrow(() -> new IllegalArgumentException("User account not found: " + userId));

        boolean eligible = userAccountRepository.calculateRentalEligibility(userId) == 1;
        user.changeRentalEligibility(eligible);
        return eligible;
    }
}
