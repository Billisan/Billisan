package dev.billisan.global.exception;

/** userRef로 USER_ACCOUNT를 찾을 수 없을 때. */
public class UserNotFoundException extends RuntimeException {
    public UserNotFoundException(String message) {
        super(message);
    }
}
