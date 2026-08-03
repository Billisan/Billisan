package dev.billisan.global.exception;

/** 대여소에 AVAILABLE+OCCUPIED+NORMAL+LOCKED 조건을 만족하는 checkout 후보 슬롯이 없을 때. */
public class NoAvailableSlotException extends RuntimeException {
    public NoAvailableSlotException(String message) {
        super(message);
    }
}
