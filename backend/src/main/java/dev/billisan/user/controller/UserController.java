package dev.billisan.user.controller;

import dev.billisan.user.dto.UserProfileResponse;
import dev.billisan.user.service.UserProfileService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class UserController {

    private final UserProfileService userProfileService;

    public UserController(UserProfileService userProfileService) {
        this.userProfileService = userProfileService;
    }

    @GetMapping("/api/v1/users/me")
    public ResponseEntity<UserProfileResponse> getMe(
            @RequestHeader("X-Request-Id") UUID requestId,
            @AuthenticationPrincipal UUID userRef) {
        return ResponseEntity.ok(userProfileService.getProfile(userRef));
    }
}
