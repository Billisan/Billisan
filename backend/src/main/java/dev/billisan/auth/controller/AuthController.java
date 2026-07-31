package dev.billisan.auth.controller;

import dev.billisan.auth.dto.LoginRequest;
import dev.billisan.auth.dto.LoginResponse;
import dev.billisan.auth.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/api/v1/auth/login")
    public ResponseEntity<LoginResponse> login(
            @RequestHeader("X-Request-Id") UUID requestId,
            @Valid @RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }
}
