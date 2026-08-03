package dev.billisan.chatbot.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import dev.billisan.chatbot.dto.ChatCta;
import dev.billisan.chatbot.dto.ChatIntent;
import dev.billisan.chatbot.dto.ChatMessageResponse;
import dev.billisan.chatbot.dto.ChatSource;
import dev.billisan.chatbot.knowledge.FaqKnowledge;
import dev.billisan.global.exception.ChatbotMessageRequiredException;
import dev.billisan.global.exception.ChatbotMessageTooLongException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * {@link ChatbotService}의 검증/성공/빈 응답/잘못된 intent/예외 경로를 직접 검증한다.
 *
 * <p>2026-08-03: Spring AI 제거로 {@link ChatModel} 목킹 대신 {@link MockRestServiceServer}로
 * 실제 {@link RestClient} 호출·JSON (역)직렬화 경로를 그대로 검증한다.
 */
class ChatbotServiceTest {

    private static final String STATIC_FALLBACK =
            "죄송해요, 지금은 답변을 드리기 어려워요. 자주 묻는 질문(FAQ) 화면을 확인해 주세요.";
    private static final int MAX_MESSAGE_LENGTH = 500;
    private static final String BASE_URL = "https://gms.example.test";

    private final ObjectMapper objectMapper = JsonMapper.builder().build();

    private MockRestServiceServer mockServer;
    private ChatbotService service;

    @BeforeEach
    void setUp() {
        FaqKnowledge faqKnowledge = mock(FaqKnowledge.class);
        when(faqKnowledge.content()).thenReturn("과금 규칙 등 지식 문서 더미");

        RestClient.Builder builder = RestClient.builder();
        mockServer = MockRestServiceServer.bindTo(builder).build();

        service = new ChatbotService(builder, objectMapper, faqKnowledge,
                BASE_URL, "test-key", "gpt-5.4-nano", 0.2, MAX_MESSAGE_LENGTH);
    }

    private String chatCompletionJson(String content) {
        return """
                {"choices":[{"message":{"role":"assistant","content":%s}}],
                 "usage":{"prompt_tokens":1200,"completion_tokens":80,"total_tokens":1280}}
                """.formatted(objectMapper.writeValueAsString(content));
    }

    @Test
    void throwsWhenMessageBlank() {
        assertThatThrownBy(() -> service.reply("req-blank", "   "))
                .isInstanceOf(ChatbotMessageRequiredException.class);
    }

    @Test
    void throwsWhenMessageTooLong() {
        String tooLong = "가".repeat(MAX_MESSAGE_LENGTH + 1);

        assertThatThrownBy(() -> service.reply("req-toolong", tooLong))
                .isInstanceOf(ChatbotMessageTooLongException.class);
    }

    @Test
    void returnsModelContentOnSuccess() {
        String content = "{\"answer\":\"24시간은 무료예요.\",\"intent\":\"UNSETTLED_GUIDE\",\"cta\":\"OPEN_MY_PAGE\"}";
        mockServer.expect(requestTo(BASE_URL + "/chat/completions"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(chatCompletionJson(content), MediaType.APPLICATION_JSON));

        ChatMessageResponse response = service.reply("req-1", "이용 요금이 얼마야?");

        assertThat(response.answer()).isEqualTo("24시간은 무료예요.");
        assertThat(response.intent()).isEqualTo(ChatIntent.UNSETTLED_GUIDE);
        assertThat(response.action().type()).isEqualTo(ChatCta.OPEN_MY_PAGE);
        assertThat(response.action().label()).isEqualTo("내 정보 보기");
        assertThat(response.source()).isEqualTo(ChatSource.EXTERNAL_LLM);
        assertThat(response.fallback()).isFalse();
        mockServer.verify();
    }

    @Test
    void fallsBackToGeneralInquiryAndNoneWhenModelReturnsUnknownEnumValues() {
        String content = "{\"answer\":\"안내드릴게요.\",\"intent\":\"NOT_A_REAL_INTENT\",\"cta\":\"NOT_A_REAL_CTA\"}";
        mockServer.expect(requestTo(BASE_URL + "/chat/completions"))
                .andRespond(withSuccess(chatCompletionJson(content), MediaType.APPLICATION_JSON));

        ChatMessageResponse response = service.reply("req-x", "질문");

        assertThat(response.answer()).isEqualTo("안내드릴게요.");
        assertThat(response.intent()).isEqualTo(ChatIntent.GENERAL_INQUIRY);
        assertThat(response.action().type()).isEqualTo(ChatCta.NONE);
        assertThat(response.fallback()).isFalse();
    }

    @Test
    void returnsStaticFallbackWhenAnswerFieldEmpty() {
        String content = "{\"answer\":\"\",\"intent\":\"GENERAL_INQUIRY\",\"cta\":\"NONE\"}";
        mockServer.expect(requestTo(BASE_URL + "/chat/completions"))
                .andRespond(withSuccess(chatCompletionJson(content), MediaType.APPLICATION_JSON));

        ChatMessageResponse response = service.reply("req-empty", "질문");

        assertThat(response.answer()).isEqualTo(STATIC_FALLBACK);
        assertThat(response.source()).isEqualTo(ChatSource.STATIC_FAQ_FALLBACK);
        assertThat(response.fallback()).isTrue();
    }

    @Test
    void returnsStaticFallbackWhenNoChoicesReturned() {
        mockServer.expect(requestTo(BASE_URL + "/chat/completions"))
                .andRespond(withSuccess("{\"choices\":[]}", MediaType.APPLICATION_JSON));

        ChatMessageResponse response = service.reply("req-nochoice", "질문");

        assertThat(response.answer()).isEqualTo(STATIC_FALLBACK);
        assertThat(response.fallback()).isTrue();
    }

    @Test
    void returnsStaticFallbackWhenServerErrors() {
        mockServer.expect(requestTo(BASE_URL + "/chat/completions"))
                .andRespond(withServerError());

        ChatMessageResponse response = service.reply("req-3", "아무 질문");

        assertThat(response.answer()).isEqualTo(STATIC_FALLBACK);
        assertThat(response.intent()).isEqualTo(ChatIntent.GENERAL_INQUIRY);
        assertThat(response.action().type()).isEqualTo(ChatCta.NONE);
        assertThat(response.fallback()).isTrue();
    }
}
