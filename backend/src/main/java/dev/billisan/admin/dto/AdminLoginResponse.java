package dev.billisan.admin.dto;

import java.time.Instant;
import java.util.UUID;

public record AdminLoginResponse(
        String accessToken,
        String tokenType,
        UUID adminId,
        String loginId,
        String role,
        Instant idleExpiresAt,
        Instant absoluteExpiresAt
) {
    public static AdminLoginResponse of(
            String accessToken,
            UUID adminId,
            String loginId,
            Instant idleExpiresAt,
            Instant absoluteExpiresAt) {
        return new AdminLoginResponse(accessToken, "Bearer", adminId, loginId, "ADMIN", idleExpiresAt, absoluteExpiresAt);
    }
}
