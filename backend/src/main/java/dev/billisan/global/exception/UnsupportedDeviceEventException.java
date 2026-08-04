package dev.billisan.global.exception;

/** returnAttemptId가 실린 반납(LOCK) 이벤트 등, 아직 지원하지 않는 장치 이벤트일 때. */
public class UnsupportedDeviceEventException extends RuntimeException {
    public UnsupportedDeviceEventException(String message) {
        super(message);
    }
}
