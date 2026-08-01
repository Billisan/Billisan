package dev.billisan.global.exception;

/** 409 SLOT_STATUS_CONFLICT — expectedUpdatedAt이 서버의 현재 값과 다를 때(CAS 실패). */
public class SlotStatusConflictException extends RuntimeException {
    public SlotStatusConflictException(String message) {
        super(message);
    }
}
