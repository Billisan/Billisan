package dev.billisan.auth.dto;

import java.time.Instant;

public record LoginResponse(
        String accessToken,
        String tokenType,
        Instant expiresAt,
        String userId,
        boolean faceRegistered
) {
    public static LoginResponse of(String accessToken, Instant expiresAt, String userId, boolean faceRegistered) {
        return new LoginResponse(accessToken, "Bearer", expiresAt, userId, faceRegistered);
    }
}