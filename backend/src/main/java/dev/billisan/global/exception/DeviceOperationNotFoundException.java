package dev.billisan.global.exception;

/** commandId로 장치 명령(DeviceOperation)을 찾을 수 없을 때. */
public class DeviceOperationNotFoundException extends RuntimeException {
    public DeviceOperationNotFoundException(String message) {
        super(message);
    }
}
