package dev.billisan.user.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class UserAccountTests {

    @Test
    void newUserIsFailClosedForRentalEligibility() {
        UserAccount user = UserAccount.create(
                "123456789",
                "fixture-3ba43c4927c4@example.invalid",
                "encoded-password",
                "Test User");

        assertThat(user.isRentalEligible()).isFalse();
        assertThat(user.getRentalEligibilityUpdatedAt()).isNotNull();
    }

    @Test
    void changingRentalEligibilityAlsoAdvancesItsTimestamp() {
        UserAccount user = UserAccount.create(
                "123456789",
                "fixture-3ba43c4927c4@example.invalid",
                "encoded-password",
                "Test User");
        LocalDateTime before = user.getRentalEligibilityUpdatedAt();

        user.changeRentalEligibility(true);

        assertThat(user.isRentalEligible()).isTrue();
        assertThat(user.getRentalEligibilityUpdatedAt()).isAfterOrEqualTo(before);
    }
}
