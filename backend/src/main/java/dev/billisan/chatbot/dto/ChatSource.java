package dev.billisan.chatbot.dto;

/**
 * 통합 API 계약(12-R) {@code CHATBOT-001} 응답의 {@code source} 3종.
 *
 * <p>{@link #STATIC_FAQ}(순수 정적 매칭, LLM 미호출)는 현재 구현에 없다 — 모든 요청이
 * 지식 문서를 시스템 프롬프트로 주입한 LLM을 항상 호출하고, 성공하면 {@link #EXTERNAL_LLM},
 * 실패·빈 응답이면 {@link #STATIC_FAQ_FALLBACK}로만 갈린다.
 */
public enum ChatSource {
    STATIC_FAQ,
    EXTERNAL_LLM,
    STATIC_FAQ_FALLBACK
}
