package dev.billisan.chatbot.dto;

import java.util.UUID;

/**
 * {@code POST /api/v1/chatbot/messages}(CHATBOT-001) 응답 바디 — 12-R 원문 필드 구성과
 * 일치(`messageId`·`answer`·`intent`·`action.type`·`action.label`·`source`·`fallback`).
 *
 * <p>이 프로젝트의 다른 API(예: {@code UserLoginResponse})와 같은 스타일로 봉투 없이
 * 평평하게(flat) 반환한다 — {@code success}/{@code data}/{@code meta} 래퍼는 쓰지 않는다.
 */
public record ChatMessageResponse(
        UUID messageId,
        String answer,
        ChatIntent intent,
        ChatAction action,
        ChatSource source,
        boolean fallback) {

    public record ChatAction(ChatCta type, String label) {
    }

    public static ChatMessageResponse of(String answer, ChatIntent intent, ChatCta cta,
                                          ChatSource source, boolean fallback) {
        return new ChatMessageResponse(
                UUID.randomUUID(), answer, intent, new ChatAction(cta, cta.label()), source, fallback);
    }
}
