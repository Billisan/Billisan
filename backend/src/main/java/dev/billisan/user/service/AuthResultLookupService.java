package dev.billisan.user.service;

import dev.billisan.global.exception.UserNotFoundException;
import dev.billisan.user.domain.UserAccount;
import dev.billisan.user.dto.AuthResultResponse;
import dev.billisan.user.repository.UserAccountRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** EDGE-AUTH-001 — 얼굴 인증 성공 직후 userRef로 표시정보·서비스 자격을 조회한다. DB에는 아무것도 쓰지 않는다. */
@Service
@Transactional(readOnly = true)
public class AuthResultLookupService {

    private final UserAccountRepository userAccountRepository;

    public AuthResultLookupService(UserAccountRepository userAccountRepository) {
        this.userAccountRepository = userAccountRepository;
    }

    public AuthResultResponse lookup(UUID userRef) {
        return AuthResultResponse.of(requireUser(userRef));
    }

    private UserAccount requireUser(UUID userRef) {
        return userAccountRepository.findByUserRef(userRef)
                .orElseThrow(() -> new UserNotFoundException("userRef로 사용자를 찾을 수 없습니다: " + userRef));
    }
}
