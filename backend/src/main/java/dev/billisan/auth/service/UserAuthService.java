package dev.billisan.auth.service;

import dev.billisan.auth.dto.UserLoginRequest;
import dev.billisan.auth.dto.UserLoginResponse;
import dev.billisan.global.exception.InvalidCredentialsException;
import dev.billisan.global.security.JwtProvider;
import dev.billisan.global.security.Role;
import dev.billisan.user.domain.UserAccount;
import dev.billisan.user.repository.UserAccountRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;

@Service
public class UserAuthService {

    private final UserAccountRepository userAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;
    private final long expirationSeconds;

    public UserAuthService(
            UserAccountRepository userAccountRepository,
            PasswordEncoder passwordEncoder,
            JwtProvider jwtProvider,
            @Value("${jwt.expiration-seconds}") long expirationSeconds) {
        this.userAccountRepository = userAccountRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtProvider = jwtProvider;
        this.expirationSeconds = expirationSeconds;
    }

    public UserLoginResponse login(UserLoginRequest request) {
        UserAccount user = userAccountRepository.findByLoginId(request.identifier())
                .orElseThrow(() -> new InvalidCredentialsException("아이디 또는 비밀번호가 올바르지 않습니다."));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        Instant expiresAt = Instant.now().plusSeconds(expirationSeconds);

        String token = jwtProvider.generateToken(
                user.getUserRef().toString(),
                Map.of(Role.CLAIM_KEY, Role.USER.claimValue()),
                expirationSeconds);

        UserLoginResponse.UserSummary summary = new UserLoginResponse.UserSummary(
                user.getUserRef().toString(), user.getName(), UserAccount.SCHOOL_NAME, user.isFaceRegistered());
        return UserLoginResponse.of(token, expiresAt, summary);
    }
}
