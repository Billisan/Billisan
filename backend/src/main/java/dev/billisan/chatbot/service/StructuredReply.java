package dev.billisan.chatbot.service;

/**
 * 모델 구조화 출력 파싱 전용 DTO — {@code ChatClient.CallResponseSpec#entity(Class)}가
 * 모델 응답 JSON을 이 record로 역직렬화한다. {@code intent}·{@code cta}는 모델이 낸 원문
 * 문자열 그대로 받고, 유효성 검증·안전한 기본값 대체는 {@code ChatIntent#fromModelValue}·
 * {@code ChatCta#fromModelValue}에서 처리한다(모델이 스키마 밖 값을 낼 수 있으므로 여기서
 * enum으로 바로 받지 않는다). 응답 DTO가 아니라 {@link ChatbotService}만 쓰는 내부 구현
 * 세부라 {@code chatbot.dto}가 아니라 이 패키지에 둔다.
 */
record StructuredReply(String answer, String intent, String cta) {
}
