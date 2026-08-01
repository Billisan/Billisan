package dev.billisan.global.exception;

public class SlotNotFoundException extends RuntimeException {
    public SlotNotFoundException(String message) {
        super(message);
    }
}
