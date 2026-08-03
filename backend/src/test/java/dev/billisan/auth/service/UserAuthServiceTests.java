package dev.billisan.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.billisan.auth.dto.UserLoginRequest;
import dev.billisan.auth.dto.UserLoginResponse;
import dev.billisan.global.exception.InvalidCredentialsException;
import dev.billisan.global.security.JwtProvider;
import dev.billisan.global.security.Role;
import dev.billisan.user.domain.UserAccount;
import dev.billisan.user.repository.UserAccountRepository;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class UserAuthServiceTests {

    private static final String LOGIN_ID = "eligible.fixture@billisan.test";
    private static final String USER_ID = "202600001";
    private static final String PASSWORD = "fixture-demo-only!";
    private static final String PASSWORD_HASH = "$2a$10$fixture-hash-placeholder-for-mock";

    @Mock
    private UserAccountRepository userAccountRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtProvider jwtProvider;

    private UserAuthService userAuthService;

    @BeforeEach
    void setUp() {
        userAuthService = new UserAuthService(
                userAccountRepository,
                passwordEncoder,
                jwtProvider,
                3600);
    }

    @Test
    void loginReturnsOpaqueUserRefInsteadOfStudentNumber() {
        UserAccount user = fixtureUser();
        String userRef = user.getUserRef().toString();
        when(userAccountRepository.findByLoginId(LOGIN_ID)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(PASSWORD, PASSWORD_HASH)).thenReturn(true);
        when(jwtProvider.generateToken(
                userRef,
                Map.of(Role.CLAIM_KEY, Role.USER.claimValue()),
                3600))
                .thenReturn("fixture-access-token");

        UserLoginResponse response = userAuthService.login(new UserLoginRequest(LOGIN_ID, PASSWORD));

        assertThat(response.userRef()).isEqualTo(userRef);
        assertThat(response.userRef()).isNotEqualTo(USER_ID);
        assertThat(response.faceRegistered()).isFalse();
        assertThat(response.tokenType()).isEqualTo("Bearer");
    }

    @Test
    void loginRejectsWrongPasswordBeforeIssuingToken() {
        UserAccount user = fixtureUser();
        when(userAccountRepository.findByLoginId(LOGIN_ID)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", PASSWORD_HASH)).thenReturn(false);

        assertThatThrownBy(() -> userAuthService.login(
                new UserLoginRequest(LOGIN_ID, "wrong-password")))
                .isInstanceOf(InvalidCredentialsException.class);

        verify(jwtProvider, never()).generateToken(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyMap(),
                org.mockito.ArgumentMatchers.anyLong());
    }

    private static UserAccount fixtureUser() {
        return UserAccount.create(USER_ID, LOGIN_ID, PASSWORD_HASH, "Eligible Fixture User");
    }
}
