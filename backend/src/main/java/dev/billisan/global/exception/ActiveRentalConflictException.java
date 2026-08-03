package dev.billisan.global.exception;

/** 사용자가 이미 REQUESTED/ACTIVE/RETURNING 상태의 대여를 갖고 있을 때. */
public class ActiveRentalConflictException extends RuntimeException {
    public ActiveRentalConflictException(String message) {
        super(message);
    }
}
