package dev.billisan.chatbot.service;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;

import dev.billisan.chatbot.dto.ChatCta;
import dev.billisan.chatbot.dto.ChatIntent;
import dev.billisan.chatbot.dto.ChatMessageResponse;
import dev.billisan.chatbot.dto.ChatSource;
import dev.billisan.chatbot.knowledge.FaqKnowledge;
import dev.billisan.global.exception.ChatbotMessageRequiredException;
import dev.billisan.global.exception.ChatbotMessageTooLongException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * {@link ChatbotService}의 검증/성공/빈 응답/잘못된 intent/예외 경로를 직접 검증한다.
 *
 * <p>{@link ChatClient} 체인을 직접 목으로 만들지 않고, {@link ChatModel}만 목으로 만들어
 * 실제 {@link ChatClient}(구조화 출력 파싱 로직 포함) 위에서 검증한다.
 */
class ChatbotServiceTest {

    private static final String STATIC_FALLBACK =
            "죄송해요, 지금은 답변을 드리기 어려워요. 자주 묻는 질문(FAQ) 화면을 확인해 주세요.";
    private static final int MAX_MESSAGE_LENGTH = 500;

    private ChatbotService newService(ChatModel chatModel) {
        FaqKnowledge faqKnowledge = mock(FaqKnowledge.class);
        when(faqKnowledge.content()).thenReturn("과금 규칙 등 지식 문서 더미");
        // ChatClient가 옵션 병합 시 getOptions()를 실제로 호출한다 — Mockito 기본값(null)을
        // 두면 내부에서 NPE가 나므로 빈 옵션을 명시적으로 스텁한다.
        when(chatModel.getOptions()).thenReturn(ChatOptions.builder().build());
        return new ChatbotService(ChatClient.builder(chatModel), faqKnowledge, MAX_MESSAGE_LENGTH);
    }

    private static ChatResponse responseWithText(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
    }

    @Test
    void throwsWhenMessageBlank() {
        ChatbotService service = newService(mock(ChatModel.class));

        assertThatThrownBy(() -> service.reply("req-blank", "   "))
                .isInstanceOf(ChatbotMessageRequiredException.class);
    }

    @Test
    void throwsWhenMessageTooLong() {
        ChatbotService service = newService(mock(ChatModel.class));
        String tooLong = "가".repeat(MAX_MESSAGE_LENGTH + 1);

        assertThatThrownBy(() -> service.reply("req-toolong", tooLong))
                .isInstanceOf(ChatbotMessageTooLongException.class);
    }

    @Test
    void returnsModelContentOnSuccess() {
        ChatModel chatModel = mock(ChatModel.class);
        when(chatModel.call(any(Prompt.class))).thenReturn(responseWithText(
                "{\"answer\":\"24시간은 무료예요.\",\"intent\":\"UNSETTLED_GUIDE\",\"cta\":\"OPEN_MY_PAGE\"}"));

        ChatMessageResponse response = newService(chatModel).reply("req-1", "이용 요금이 얼마야?");

        assertThat(response.answer()).isEqualTo("24시간은 무료예요.");
        assertThat(response.intent()).isEqualTo(ChatIntent.UNSETTLED_GUIDE);
        assertThat(response.action().type()).isEqualTo(ChatCta.OPEN_MY_PAGE);
        assertThat(response.action().label()).isEqualTo("내 정보 보기");
        assertThat(response.source()).isEqualTo(ChatSource.EXTERNAL_LLM);
        assertThat(response.fallback()).isFalse();
    }

    @Test
    void fallsBackToGeneralInquiryAndNoneWhenModelReturnsUnknownEnumValues() {
        ChatModel chatModel = mock(ChatModel.class);
        when(chatModel.call(any(Prompt.class))).thenReturn(responseWithText(
                "{\"answer\":\"안내드릴게요.\",\"intent\":\"NOT_A_REAL_INTENT\",\"cta\":\"NOT_A_REAL_CTA\"}"));

        ChatMessageResponse response = newService(chatModel).reply("req-x", "질문");

        assertThat(response.answer()).isEqualTo("안내드릴게요.");
        assertThat(response.intent()).isEqualTo(ChatIntent.GENERAL_INQUIRY);
        assertThat(response.action().type()).isEqualTo(ChatCta.NONE);
        assertThat(response.fallback()).isFalse();
    }

    @Test
    void returnsStaticFallbackWhenAnswerFieldEmpty() {
        ChatModel chatModel = mock(ChatModel.class);
        when(chatModel.call(any(Prompt.class))).thenReturn(responseWithText(
                "{\"answer\":\"\",\"intent\":\"GENERAL_INQUIRY\",\"cta\":\"NONE\"}"));

        ChatMessageResponse response = newService(chatModel).reply("req-empty", "질문");

        assertThat(response.answer()).isEqualTo(STATIC_FALLBACK);
        assertThat(response.source()).isEqualTo(ChatSource.STATIC_FAQ_FALLBACK);
        assertThat(response.fallback()).isTrue();
    }

    @Test
    void returnsStaticFallbackWhenModelCallThrows() {
        ChatModel chatModel = mock(ChatModel.class);
        when(chatModel.call(any(Prompt.class))).thenThrow(new RuntimeException("gateway timeout"));

        ChatMessageResponse response = newService(chatModel).reply("req-3", "아무 질문");

        assertThat(response.answer()).isEqualTo(STATIC_FALLBACK);
        assertThat(response.intent()).isEqualTo(ChatIntent.GENERAL_INQUIRY);
        assertThat(response.action().type()).isEqualTo(ChatCta.NONE);
        assertThat(response.fallback()).isTrue();
    }
}
