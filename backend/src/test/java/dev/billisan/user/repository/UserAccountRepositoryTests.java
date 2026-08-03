package dev.billisan.user.repository;

import static org.assertj.core.api.Assertions.assertThat;

import dev.billisan.user.domain.UserAccount;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class UserAccountRepositoryTests {

    @Autowired
    private UserAccountRepository userAccountRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Test
    void savesAndReloadsRentalEligibilityProjection() {
        UserAccount user = UserAccount.create(
                "987654321",
                "fixture-932cd381a82d@example.invalid",
                "encoded-password",
                "Eligibility Test User");
        user.changeRentalEligibility(true);
        LocalDateTime expectedUpdatedAt = user.getRentalEligibilityUpdatedAt()
                .truncatedTo(ChronoUnit.MICROS);

        userAccountRepository.saveAndFlush(user);
        entityManager.clear();

        UserAccount reloaded = userAccountRepository.findById("987654321")
                .orElseThrow();

        assertThat(reloaded.isRentalEligible()).isTrue();
        assertThat(reloaded.getRentalEligibilityUpdatedAt())
                .isEqualTo(expectedUpdatedAt);
    }
}
