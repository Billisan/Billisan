package dev.billisan.global.exception;

/**
 * 409 INSPECTION_ALREADY_DECIDED — 이미 확정된 검수를 재판정하려는 시도. CAS 실패
 * ({@link InspectionConflictException}, {@code CONCURRENT_MODIFICATION})와는 다른 코드로
 * 구분한다.
 */
public class InspectionAlreadyDecidedException extends RuntimeException {
    public InspectionAlreadyDecidedException(String message) {
        super(message);
    }
}
