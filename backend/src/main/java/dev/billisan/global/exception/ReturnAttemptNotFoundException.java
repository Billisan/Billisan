package dev.billisan.global.exception;

/** returnAttemptId로 반납 시도를 찾을 수 없을 때. */
public class ReturnAttemptNotFoundException extends RuntimeException {
    public ReturnAttemptNotFoundException(String message) {
        super(message);
    }
}
