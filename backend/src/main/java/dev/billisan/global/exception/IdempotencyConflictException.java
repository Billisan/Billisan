package dev.billisan.global.exception;

/** 같은 rentalRequestId로 이전과 다른 내용의 요청이 재전송됐을 때. */
public class IdempotencyConflictException extends RuntimeException {
    public IdempotencyConflictException(String message) {
        super(message);
    }
}
