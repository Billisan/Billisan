package dev.billisan.chatbot.service;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * GMS(OpenAI 호환 게이트웨이) {@code POST /chat/completions} 응답 바디 — 필요한 필드만 받는다
 * ({@code @JsonIgnoreProperties(ignoreUnknown = true)}로 나머지는 무시).
 *
 * <p>{@code usage}는 매 요청마다 시스템 프롬프트(FAQ 지식 문서 포함, 2026-08-03 실측
 * ~4,100자)를 통째로 다시 보내는 게 실제로 얼마나 비싼지, 캐싱이 적용되는지를 로그로
 * 확인하기 위해 받는다(질문 원문·답변 원문은 여전히 로그에 안 남긴다 — 숫자만).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
record ChatCompletionResponse(List<Choice> choices, Usage usage) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Choice(ChatMessage message) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Usage(
            @JsonProperty("prompt_tokens") Integer promptTokens,
            @JsonProperty("completion_tokens") Integer completionTokens,
            @JsonProperty("total_tokens") Integer totalTokens,
            @JsonProperty("prompt_tokens_details") PromptTokensDetails promptTokensDetails) {

        @JsonIgnoreProperties(ignoreUnknown = true)
        record PromptTokensDetails(@JsonProperty("cached_tokens") Integer cachedTokens) {
        }
    }
}
