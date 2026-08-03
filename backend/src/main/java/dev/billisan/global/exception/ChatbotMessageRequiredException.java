package dev.billisan.global.exception;

/**
 * 400 CHATBOT_MESSAGE_REQUIRED — {@code message}가 비어있을 때. 12-R 계약이 이 케이스를
 * 범용 400 INVALID_REQUEST와 구분되는 전용 코드로 요구해서(다른 검증 실패와 섞이지 않게),
 * Bean Validation이 아니라 서비스 계층에서 직접 검증해 전용 예외로 던진다
 * ({@link AdminReasonRequiredException}과 같은 패턴).
 */
public class ChatbotMessageRequiredException extends RuntimeException {
    public ChatbotMessageRequiredException(String message) {
        super(message);
    }
}
