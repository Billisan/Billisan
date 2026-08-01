package dev.billisan.global.exception;

public class InspectionNotFoundException extends RuntimeException {
    public InspectionNotFoundException(String message) {
        super(message);
    }
}
