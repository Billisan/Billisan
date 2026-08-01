package dev.billisan.global.exception;

/**
 * 403 ADMIN_ACCOUNT_REQUIRED — `USER_ACCOUNT.role=ADMIN`이 아니라 별도 `ADMIN_ACCOUNT`를
 * 전제하는 v3.0 인증 모델에서, 관리자 채널로 인증되지 않은 주체가 보호된 엔드포인트를
 * 호출할 때 던진다.
 */
public class AdminAccountRequiredException extends RuntimeException {
    public AdminAccountRequiredException(String message) {
        super(message);
    }
}
