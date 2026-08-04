package dev.billisan.global.exception;

/** 사용자에게 ACTIVE 상태의 대여가 없어 반납 시도를 시작할 수 없을 때. */
public class ActiveRentalNotFoundException extends RuntimeException {
    public ActiveRentalNotFoundException(String message) {
        super(message);
    }
}
