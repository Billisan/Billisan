package dev.billisan.chatbot.dto;

/**
 * 통합 API 계약(12-R) {@code CHATBOT-001} 응답의 {@code action.type} CTA 5종.
 * {@link #label}은 12-R 원문 {@code action.label}(String, 필수 — "사용자 표시 CTA 문구")에
 * 대응하는 고정 한국어 문구다.
 */
public enum ChatCta {
    OPEN_MAP("대여소 지도 보기"),
    OPEN_MY_PAGE("내 정보 보기"),
    OPEN_HISTORY("대여 이력 보기"),
    OPEN_INQUIRY("문의하기"),
    NONE("");

    private final String label;

    ChatCta(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    /**
     * 모델이 반환한 원문 값을 매핑한다. 5종 밖의 값이거나 비어 있으면 {@link #NONE}으로
     * 안전하게 대체한다.
     */
    public static ChatCta fromModelValue(String value) {
        if (value == null) {
            return NONE;
        }
        try {
            return ChatCta.valueOf(value.trim());
        } catch (IllegalArgumentException e) {
            return NONE;
        }
    }
}
