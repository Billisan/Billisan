package dev.billisan.auth.dto;

import java.time.Instant;

public record UserLoginResponse(
        String accessToken,
        String tokenType,
        Instant expiresAt,
        String userRef,
        boolean faceRegistered
) {
    public static UserLoginResponse of(String accessToken, Instant expiresAt, String userRef, boolean faceRegistered) {
        return new UserLoginResponse(accessToken, "Bearer", expiresAt, userRef, faceRegistered);
    }
}
