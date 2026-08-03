package dev.billisan.global.exception;

/** rentalId로 대여를 찾을 수 없을 때. */
public class RentalNotFoundException extends RuntimeException {
    public RentalNotFoundException(String message) {
        super(message);
    }
}
