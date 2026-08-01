package dev.billisan.global.exception;

/** 400 INVALID_SLOT_STATUS_COMBINATION — 허용되지 않는 serviceStatus+itemCondition 조합. */
public class InvalidSlotStatusTransitionException extends RuntimeException {
    public InvalidSlotStatusTransitionException(String message) {
        super(message);
    }
}
