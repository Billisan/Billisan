package dev.billisan.user.repository;

import dev.billisan.user.domain.UserAccount;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.UUID;

public interface UserAccountRepository extends JpaRepository<UserAccount, String> {
    Optional<UserAccount> findByLoginId(String loginId);

    Optional<UserAccount> findByUserRef(UUID userRef);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from UserAccount u where u.userId = :userId")
    Optional<UserAccount> findByIdForEligibilityUpdate(@Param("userId") String userId);

    /**
     * Calculates only user-level rental eligibility from authoritative business facts.
     * Station operation, slot inventory, device connectivity, and MQTT availability are
     * intentionally outside this projection.
     */
    @Query(value = """
            SELECT CASE WHEN EXISTS (
                SELECT 1
                FROM `user_account` AS `u`
                WHERE `u`.`user_id` = :userId
                  AND `u`.`face_registered` = TRUE
                  AND NOT EXISTS (
                      SELECT 1
                      FROM `rental` AS `r`
                      WHERE `r`.`user_id` = `u`.`user_id`
                        AND `r`.`status` IN ('REQUESTED', 'ACTIVE', 'RETURNING')
                  )
                  AND NOT EXISTS (
                      SELECT 1
                      FROM `return_attempt` AS `ra`
                      INNER JOIN `rental` AS `r`
                          ON `r`.`rental_id` = `ra`.`rental_id`
                      WHERE `r`.`user_id` = `u`.`user_id`
                        AND `ra`.`status` = 'RECOVERY_REQUIRED'
                  )
                  AND NOT EXISTS (
                      SELECT 1
                      FROM `settlement` AS `s`
                      WHERE `s`.`user_id` = `u`.`user_id`
                        AND `s`.`status` = 'PENDING'
                        AND `s`.`amount` > `s`.`paid_amount`
                  )
            ) THEN 1 ELSE 0 END
            """, nativeQuery = true)
    int calculateRentalEligibility(@Param("userId") String userId);
}
