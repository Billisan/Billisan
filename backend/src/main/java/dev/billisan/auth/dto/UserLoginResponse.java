package dev.billisan.auth.dto;

import java.time.Instant;

public record UserLoginResponse(
        String accessToken,
        String tokenType,
        Instant expiresAt,
        String userId,
        boolean faceRegistered
) {
    public static UserLoginResponse of(String accessToken, Instant expiresAt, String userId, boolean faceRegistered) {
        return new UserLoginResponse(accessToken, "Bearer", expiresAt, userId, faceRegistered);
    }
}
