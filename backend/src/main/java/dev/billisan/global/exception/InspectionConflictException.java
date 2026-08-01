package dev.billisan.global.exception;

/**
 * 409 CONCURRENT_MODIFICATION — {@code expectedUpdatedAt} 불일치(CAS 실패)만 나타낸다.
 * 이미 확정된 검수 재판정 시도는 {@link InspectionAlreadyDecidedException}
 * (409 INSPECTION_ALREADY_DECIDED)으로 분리한다 — 관리자 웹이 두 409를 서로 다르게 처리한다.
 */
public class InspectionConflictException extends RuntimeException {
    public InspectionConflictException(String message) {
        super(message);
    }
}
