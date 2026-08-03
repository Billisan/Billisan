package dev.billisan.chatbot.dto;

/**
 * 통합 API 계약(12-R) {@code CHATBOT-001} 응답의 {@code intent} 7종.
 */
public enum ChatIntent {
    RENTAL_GUIDE,
    RETURN_GUIDE,
    EXTENSION_GUIDE,
    LOSS_OR_DAMAGE_GUIDE,
    UNSETTLED_GUIDE,
    STATION_GUIDE,
    GENERAL_INQUIRY;

    /**
     * 모델이 반환한 원문 값을 매핑한다. 모델이 7종 밖의 값을 내놓거나 비워두면
     * {@link #GENERAL_INQUIRY}로 안전하게 대체한다 — 잘못된 분류로 클라이언트 계약을
     * 깨뜨리지 않기 위함이다.
     */
    public static ChatIntent fromModelValue(String value) {
        if (value == null) {
            return GENERAL_INQUIRY;
        }
        try {
            return ChatIntent.valueOf(value.trim());
        } catch (IllegalArgumentException e) {
            return GENERAL_INQUIRY;
        }
    }
}
