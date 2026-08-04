package dev.billisan.global.exception;

/** 대여소에 AVAILABLE+EMPTY+LOCKED 조건을 만족하는 반납 후보 슬롯이 없을 때. */
public class NoReturnSlotException extends RuntimeException {
    public NoReturnSlotException(String message) {
        super(message);
    }
}
