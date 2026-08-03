package dev.billisan.chatbot.dto;

import java.util.UUID;

/**
 * {@code POST /api/v1/chatbot/messages} 요청 바디 — Notion `12-R REST API 명세서 v3.0`
 * 원문과 대조해 필드 형태를 맞췄다.
 *
 * <p>{@code message} 필수·길이 검증은 Bean Validation이 아니라 {@code ChatbotService}에서
 * 직접 하고 전용 예외({@code ChatbotMessageRequiredException}/{@code
 * ChatbotMessageTooLongException})를 던진다 — 12-R이 이 두 케이스에 범용 400
 * INVALID_REQUEST와 다른 전용 코드를 요구해서다({@code AdminReasonRequiredException}과
 * 같은 이유).
 *
 * <p>대화 기록은 서버가 들고 있지 않는다(CLAUDE.md "챗봇 전용 DB 없음") — 매 요청이 독립적인
 * 단발 질의응답이다. {@code requestId}(동일 바디 재전송 추적·중복 응답 방지용, 헤더
 * {@code X-Request-Id}와 별개)는 파싱만 하고 아직 멱등 캐시 로직에서 쓰지 않는다.
 * {@code screenContext} 허용 값 목록은 12-R 원문에서도 찾지 못해 자유 문자열로만 받아둔다.
 * {@code clientContext}는 원문이 "권한 판단 근거로 사용 금지"라고 명시한 화면 힌트일 뿐이라
 * 값을 받아도 자격 검증에는 절대 쓰지 않는다.
 */
public record ChatMessageRequest(
        UUID requestId,
        String message,
        String screenContext,
        ClientContext clientContext) {

    public record ClientContext(Boolean hasActiveRental, Boolean hasPendingSettlement) {
    }
}
