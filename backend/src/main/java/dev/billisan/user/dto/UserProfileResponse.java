package dev.billisan.user.dto;

import dev.billisan.user.domain.UserAccount;

/** 12-R USER-001 응답 계약 — studentNumber/loginId/role/faceRegistered는 응답하지 않는다. */
public record UserProfileResponse(String userId, String displayName, String schoolName) {

    public static UserProfileResponse of(UserAccount user) {
        return new UserProfileResponse(user.getUserRef().toString(), user.getName(), UserAccount.SCHOOL_NAME);
    }
}
