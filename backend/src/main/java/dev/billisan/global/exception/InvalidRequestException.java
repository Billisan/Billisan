package dev.billisan.global.exception;

/** 헤더·타입 불일치처럼 Spring이 자동으로 잡아주지 못하는, 서비스 계층에서 발견한 잘못된 요청값. */
public class InvalidRequestException extends RuntimeException {
    public InvalidRequestException(String message) {
        super(message);
    }

    public InvalidRequestException(String message, Throwable cause) {
        super(message, cause);
    }
}
