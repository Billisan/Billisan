package dev.billisan.chatbot.service;

import java.util.List;

/**
 * GMS(OpenAI 호환 게이트웨이) {@code POST /chat/completions} 요청 바디.
 *
 * <p>Spring AI를 걷어내고 {@code RestClient}로 직접 호출한다(2026-08-03) — 챗봇이 실제로
 * 쓰는 기능은 "system+user 메시지 보내고 JSON 답 받기" 하나뿐인데, Spring AI의
 * {@code spring-ai-starter-model-openai}는 이걸 위해 공식 OpenAI Java SDK(42MB) +
 * WebClient/Reactor Netty 스트리밍 스택(우리는 안 쓰는 {@code .stream()}용) 전체를
 * 끌고 와 부트jar를 90MB+ 불렸다. 표준 OpenAI 호환 스키마이므로 record 하나면 충분하다.
 *
 * <p>⚠️ {@code response_format: {"type":"json_object"}}(JSON 모드)는 **의도적으로 넣지
 * 않는다.** 이 GMS/gpt-5.4-nano 조합에서 JSON 모드를 켜면 한글 답변이 재현성 있게 깨진다
 * (lone surrogate — 실측: "우산 요금이 얼마예요?" 동일 질문을 여러 번 호출해 매번 재현,
 * 영어 답변은 정상이었음, 모델 스스로도 "문장이 깨져 보입니다"라고 답할 정도). 프롬프트
 * 지시만으로 JSON을 받는 방식(시스템 프롬프트 참고)은 같은 조합에서 한글도 정상 동작함을
 * 실측 확인했다 — 그래서 이 방식을 쓴다.
 */
record ChatCompletionRequest(String model, double temperature, List<ChatMessage> messages) {
}
