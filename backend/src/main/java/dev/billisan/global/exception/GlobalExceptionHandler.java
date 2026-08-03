package dev.billisan.global.exception;

import dev.billisan.global.response.ApiError;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().get(0).getDefaultMessage();
        return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST", message));
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ApiError> handleInvalidCredentials(InvalidCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiError("INVALID_CREDENTIALS", ex.getMessage()));
    }

    @ExceptionHandler(InvalidAdminCredentialsException.class)
    public ResponseEntity<ApiError> handleInvalidAdminCredentials(InvalidAdminCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiError("INVALID_ADMIN_CREDENTIALS", ex.getMessage()));
    }

    /**
     * 실기 테스트로 발견: 이 핸들러가 없으면 catch-all(아래 {@code handleUnexpected})이
     * {@code MissingRequestHeaderException}까지 가로채 400이어야 할 응답을 500으로
     * 바꿔버린다. {@code @RequestHeader} 필수 헤더(`X-Request-Id` 등) 하나만 안 보내도 이
     * 경로를 탄다 — 카탈로그 형태 예외는 이렇게 개별 핸들러로 catch-all보다 먼저 잡아야 한다.
     */
    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<ApiError> handleMissingHeader(MissingRequestHeaderException ex) {
        return ResponseEntity.badRequest()
                .body(new ApiError("INVALID_REQUEST", "필수 헤더가 없습니다: " + ex.getHeaderName()));
    }

    /**
     * 실기 테스트로 발견: 잘못된 JSON 본문(파싱 자체가 안 되는 경우)도 catch-all에 걸려
     * 500이 되고 있었다 — 위 {@code MissingRequestHeaderException}과 같은 종류의 문제.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleUnreadableBody(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST", "요청 본문을 읽을 수 없습니다."));
    }

    @ExceptionHandler(AdminAccountRequiredException.class)
    public ResponseEntity<ApiError> handleAdminAccountRequired(AdminAccountRequiredException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiError("ADMIN_ACCOUNT_REQUIRED", ex.getMessage()));
    }

    @ExceptionHandler(StationNotFoundException.class)
    public ResponseEntity<ApiError> handleStationNotFound(StationNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError("STATION_NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(SlotNotFoundException.class)
    public ResponseEntity<ApiError> handleSlotNotFound(SlotNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError("SLOT_NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(InspectionNotFoundException.class)
    public ResponseEntity<ApiError> handleInspectionNotFound(InspectionNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError("INSPECTION_NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(InvalidSlotStatusTransitionException.class)
    public ResponseEntity<ApiError> handleInvalidSlotStatusTransition(InvalidSlotStatusTransitionException ex) {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_SLOT_STATUS_COMBINATION", ex.getMessage()));
    }

    @ExceptionHandler(SlotStatusConflictException.class)
    public ResponseEntity<ApiError> handleSlotStatusConflict(SlotStatusConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError("SLOT_STATUS_CONFLICT", ex.getMessage()));
    }

    @ExceptionHandler(InspectionConflictException.class)
    public ResponseEntity<ApiError> handleInspectionConflict(InspectionConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError("CONCURRENT_MODIFICATION", ex.getMessage()));
    }

    @ExceptionHandler(InspectionAlreadyDecidedException.class)
    public ResponseEntity<ApiError> handleInspectionAlreadyDecided(InspectionAlreadyDecidedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError("INSPECTION_ALREADY_DECIDED", ex.getMessage()));
    }

    @ExceptionHandler(AdminReasonRequiredException.class)
    public ResponseEntity<ApiError> handleAdminReasonRequired(AdminReasonRequiredException ex) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(new ApiError("ADMIN_REASON_REQUIRED", ex.getMessage()));
    }

    @ExceptionHandler(ChatbotMessageRequiredException.class)
    public ResponseEntity<ApiError> handleChatbotMessageRequired(ChatbotMessageRequiredException ex) {
        return ResponseEntity.badRequest().body(new ApiError("CHATBOT_MESSAGE_REQUIRED", ex.getMessage()));
    }

    @ExceptionHandler(ChatbotMessageTooLongException.class)
    public ResponseEntity<ApiError> handleChatbotMessageTooLong(ChatbotMessageTooLongException ex) {
        return ResponseEntity.badRequest().body(new ApiError("CHATBOT_MESSAGE_TOO_LONG", ex.getMessage()));
    }

    /**
     * 예상 못 한 예외를 Spring 기본 에러 페이지로 흘리지 않고 나머지 API와 같은
     * {@link ApiError} 형태로 맞춘다. 원문·스택트레이스는 응답에 담지 않고 서버 로그에만
     * 남긴다.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception ex) {
        log.error("처리되지 않은 예외: {}", ex.getClass().getSimpleName(), ex);
        return ResponseEntity.internalServerError()
                .body(new ApiError("INTERNAL_SERVER_ERROR", "일시적인 오류가 발생했습니다."));
    }
}
