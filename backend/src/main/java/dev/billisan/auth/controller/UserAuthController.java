package dev.billisan.auth.controller;

import dev.billisan.auth.dto.UserLoginRequest;
import dev.billisan.auth.dto.UserLoginResponse;
import dev.billisan.auth.dto.UserLogoutResponse;
import dev.billisan.auth.service.UserAuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
public class UserAuthController {

    private final UserAuthService userAuthService;

    public UserAuthController(UserAuthService userAuthService) {
        this.userAuthService = userAuthService;
    }

    @PostMapping("/login")
    public ResponseEntity<UserLoginResponse> login(
            @RequestHeader("X-Request-Id") UUID requestId,
            @Valid @RequestBody UserLoginRequest request) {
        UserLoginResponse response = userAuthService.login(request);
        return ResponseEntity.ok(response);
    }

    /**
     * 무상태 JWT라 서버 측 블록리스트가 없다 — 로그아웃은 클라이언트의 토큰 폐기로
     * 완성되며 이 호출은 응답 계약을 만족시키는 멱등 확인일 뿐이다.
     */
    @PostMapping("/logout")
    public ResponseEntity<UserLogoutResponse> logout(
            @RequestHeader("X-Request-Id") UUID requestId) {
        return ResponseEntity.ok(new UserLogoutResponse(true));
    }
}
