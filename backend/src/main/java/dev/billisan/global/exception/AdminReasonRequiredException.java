package dev.billisan.global.exception;

/**
 * 422 ADMIN_REASON_REQUIRED — {@code reasonCode}가 비어있을 때. 관리자 웹은 이 케이스를
 * 다른 검증 실패(400 INVALID_REQUEST)와 구분해서 처리한다 — 그래서 Bean Validation
 * ({@code @NotBlank})이 아니라 서비스 계층에서 직접 검증해 전용 예외로 던진다.
 */
public class AdminReasonRequiredException extends RuntimeException {
    public AdminReasonRequiredException(String message) {
        super(message);
    }
}
