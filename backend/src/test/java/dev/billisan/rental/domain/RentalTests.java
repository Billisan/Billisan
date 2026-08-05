package dev.billisan.rental.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RentalTests {

    @Test
    void activateRoundsMinuteRentalUpToNextHourThenAddsOneDay() {
        Rental rental = newRental();

        rental.activate(LocalDateTime.of(2030, 8, 5, 10, 1));

        assertThat(rental.getDueAt())
                .isEqualTo(LocalDateTime.of(2030, 8, 6, 11, 0));
    }

    @Test
    void activateRoundsExactHourRentalUpToFollowingHourThenAddsOneDay() {
        Rental rental = newRental();

        rental.activate(LocalDateTime.of(2030, 8, 5, 10, 0));

        assertThat(rental.getDueAt())
                .isEqualTo(LocalDateTime.of(2030, 8, 6, 11, 0));
    }

    @Test
    void activateSetsDueAtAfterRentedAt() {
        Rental rental = newRental();
        LocalDateTime rentedAt = LocalDateTime.of(2030, 8, 5, 10, 59, 59);

        rental.activate(rentedAt);

        assertThat(rental.getDueAt()).isAfter(rentedAt);
    }

    private static Rental newRental() {
        return Rental.request(
                "203000001",
                UUID.fromString("33000000-0000-4000-8000-000000000001"),
                "rental-due-at-policy-test");
    }
}
