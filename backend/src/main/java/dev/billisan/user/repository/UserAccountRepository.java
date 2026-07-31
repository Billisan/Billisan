package dev.billisan.user.repository;

import dev.billisan.user.domain.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface UserAccountRepository extends JpaRepository<UserAccount, String> {
    Optional<UserAccount> findByLoginId(String loginId);

    Optional<UserAccount> findByUserRef(UUID userRef);
}