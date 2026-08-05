package dev.billisan.user.service;

import dev.billisan.global.exception.UserNotFoundException;
import dev.billisan.user.domain.UserAccount;
import dev.billisan.user.dto.UserProfileResponse;
import dev.billisan.user.repository.UserAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class UserProfileService {

    private final UserAccountRepository userAccountRepository;

    public UserProfileService(UserAccountRepository userAccountRepository) {
        this.userAccountRepository = userAccountRepository;
    }

    public UserProfileResponse getProfile(UUID userRef) {
        return UserProfileResponse.of(requireUser(userRef));
    }

    private UserAccount requireUser(UUID userRef) {
        return userAccountRepository.findByUserRef(userRef)
                .orElseThrow(() -> new UserNotFoundException("userRef로 사용자를 찾을 수 없습니다: " + userRef));
    }
}
