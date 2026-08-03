package dev.billisan.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.billisan.user.domain.UserAccount;
import dev.billisan.user.repository.UserAccountRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RentalEligibilityServiceTests {

    @Mock
    private UserAccountRepository userAccountRepository;

    private RentalEligibilityService rentalEligibilityService;

    @BeforeEach
    void setUp() {
        rentalEligibilityService = new RentalEligibilityService(userAccountRepository);
    }

    @Test
    void refreshesEligibleProjectionAndTimestampFromAuthoritativeFacts() {
        UserAccount user = newUser();
        LocalDateTime previousUpdatedAt = user.getRentalEligibilityUpdatedAt();
        when(userAccountRepository.findByIdForEligibilityUpdate(user.getUserId()))
                .thenReturn(Optional.of(user));
        when(userAccountRepository.calculateRentalEligibility(user.getUserId()))
                .thenReturn(1);

        boolean eligible = rentalEligibilityService.refresh(user.getUserId());

        assertThat(eligible).isTrue();
        assertThat(user.isRentalEligible()).isTrue();
        assertThat(user.getRentalEligibilityUpdatedAt()).isAfterOrEqualTo(previousUpdatedAt);
        verify(userAccountRepository).calculateRentalEligibility(user.getUserId());
    }

    @Test
    void refreshesProjectionToFalseWhenAnyAuthoritativeBlockerExists() {
        UserAccount user = newUser();
        user.changeRentalEligibility(true);
        when(userAccountRepository.findByIdForEligibilityUpdate(user.getUserId()))
                .thenReturn(Optional.of(user));
        when(userAccountRepository.calculateRentalEligibility(user.getUserId()))
                .thenReturn(0);

        boolean eligible = rentalEligibilityService.refresh(user.getUserId());

        assertThat(eligible).isFalse();
        assertThat(user.isRentalEligible()).isFalse();
    }

    private static UserAccount newUser() {
        return UserAccount.create(
                "123456789",
                "fixture-3ba43c4927c4@example.invalid",
                "encoded-password",
                "Test User");
    }
}
