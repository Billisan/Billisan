package dev.billisan.global.exception;

/**
 * 400 CHATBOT_MESSAGE_TOO_LONG — {@code message}가 {@code chatbot.max-message-length}를
 * 넘었을 때. {@link ChatbotMessageRequiredException}과 같은 이유로 전용 예외를 쓴다.
 */
public class ChatbotMessageTooLongException extends RuntimeException {
    public ChatbotMessageTooLongException(String message) {
        super(message);
    }
}
