package dev.billisan.auth.dto;

import java.time.Instant;

public record UserLoginResponse(
        String accessToken,
        String tokenType,
        Instant expiresAt,
        UserSummary user
) {
    public static UserLoginResponse of(String accessToken, Instant expiresAt, UserSummary user) {
        return new UserLoginResponse(accessToken, "Bearer", expiresAt, user);
    }

    /** 12-R AUTH-001 응답 계약 — userId는 USER_ACCOUNT.user_ref(9자리 학번 아님). */
    public record UserSummary(String userId, String displayName, String schoolName, boolean faceRegistered) {
    }
}
