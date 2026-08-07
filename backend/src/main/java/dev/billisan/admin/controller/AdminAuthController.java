package dev.billisan.admin.controller;

import dev.billisan.admin.dto.AdminLoginRequest;
import dev.billisan.admin.dto.AdminLoginResponse;
import dev.billisan.admin.dto.AdminLogoutResponse;
import dev.billisan.admin.service.AdminAuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/auth")
public class AdminAuthController {

    private final AdminAuthService adminAuthService;

    public AdminAuthController(AdminAuthService adminAuthService) {
        this.adminAuthService = adminAuthService;
    }

    @PostMapping("/login")
    public ResponseEntity<AdminLoginResponse> login(
            @RequestHeader("X-Request-Id") UUID requestId,
            @Valid @RequestBody AdminLoginRequest request) {
        return ResponseEntity.ok(adminAuthService.login(request));
    }

    /**
     * ADMIN-AUTH-002. 무상태 JWT라 서버 측 블록리스트가 없다 — 로그아웃은 클라이언트의
     * 토큰 폐기로 완성되며 이 호출은 응답 계약을 만족시키는 멱등 확인일 뿐이다
     * ({@link dev.billisan.auth.controller.UserAuthController#logout}과 동일한 이유).
     */
    @PostMapping("/logout")
    public ResponseEntity<AdminLogoutResponse> logout(
            @RequestHeader("X-Request-Id") UUID requestId) {
        return ResponseEntity.ok(new AdminLogoutResponse(true));
    }
}
