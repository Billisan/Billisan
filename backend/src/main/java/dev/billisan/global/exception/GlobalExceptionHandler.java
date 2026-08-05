package dev.billisan.global.exception;

import dev.billisan.global.response.ApiError;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

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

    /** WEATHER-001의 필수 쿼리 파라미터(latitude/longitude)처럼 누락 시 위 헤더 케이스와 같은 이유로 400이어야 한다. */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiError> handleMissingParameter(MissingServletRequestParameterException ex) {
        return ResponseEntity.badRequest()
                .body(new ApiError("INVALID_REQUEST", "필수 파라미터가 없습니다: " + ex.getParameterName()));
    }

    /**
     * 실기 테스트로 발견: 잘못된 JSON 본문(파싱 자체가 안 되는 경우)도 catch-all에 걸려
     * 500이 되고 있었다 — 위 {@code MissingRequestHeaderException}과 같은 종류의 문제.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleUnreadableBody(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST", "요청 본문을 읽을 수 없습니다."));
    }

    /**
     * 실기 테스트로 발견(2026-08-03): {@code @RequestHeader(...) UUID requestId}처럼 타입이
     * 지정된 파라미터에 형식이 안 맞는 값(예: {@code X-Request-Id: test-1})이 오면 위 두
     * 핸들러와 같은 이유로 catch-all에 걸려 400이어야 할 응답이 500이 되고 있었다 —
     * `UserAuthController`를 포함해 `@RequestHeader UUID`를 쓰는 모든 엔드포인트에 해당.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST",
                "%s 값이 올바르지 않습니다.".formatted(ex.getName())));
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

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ApiError> handleUserNotFound(UserNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError("USER_NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(RentalNotFoundException.class)
    public ResponseEntity<ApiError> handleRentalNotFound(RentalNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError("RENTAL_NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(InvalidRequestException.class)
    public ResponseEntity<ApiError> handleInvalidRequest(InvalidRequestException ex) {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST", ex.getMessage()));
    }

    @ExceptionHandler(WeatherProviderUnavailableException.class)
    public ResponseEntity<ApiError> handleWeatherProviderUnavailable(WeatherProviderUnavailableException ex) {
        log.warn("기상청 API 호출 실패: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new ApiError("WEATHER_PROVIDER_UNAVAILABLE", "날씨 정보를 가져오지 못했습니다."));
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
     * 실기 테스트로 발견(2026-08-04): 어떤 컨트롤러에도 매핑되지 않는 경로(예: 아직 구현하지
     * 않은 오퍼레이션, 오타 URL)를 호출하면 Spring이 정적 리소스 취급으로
     * {@link NoResourceFoundException}을 던지는데, 이 핸들러가 없으면 아래 catch-all이
     * 가로채 404여야 할 응답이 500이 됐다.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> handleNoResourceFound(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiError("NOT_FOUND", "요청한 경로를 찾을 수 없습니다."));
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
