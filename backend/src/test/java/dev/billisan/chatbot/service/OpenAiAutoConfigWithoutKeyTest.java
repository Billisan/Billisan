package dev.billisan.chatbot.service;

import org.junit.jupiter.api.Test;
import org.springframework.ai.model.openai.autoconfigure.OpenAiChatAutoConfiguration;
import org.springframework.ai.model.tool.autoconfigure.ToolCallingAutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 2026-08-03 마이그레이션 검증용 — {@code GMS_KEY}(={@code spring.ai.openai.api-key})가
 * 비어있어도 Spring AI의 OpenAI 자동설정(빈 생성)이 실패하지 않는지 격리 확인한다.
 *
 * <p>{@code BillisanApplicationTests}(전체 {@code @SpringBootTest})로 직접 확인하려 했으나
 * 로컬에 MySQL이 없어(Docker Desktop 미기동) 전체 컨텍스트 로딩이 안 됐다 — 대신
 * {@link ApplicationContextRunner}로 OpenAI 자동설정만 떼어내 DB 없이 검증했다. CI의
 * {@code backend-test} 스테이지는 아직 {@code GMS_KEY} 변수가 없을 가능성이 높아서, 이
 * 컨텍스트 정도는 로컬에서 반드시 실측해둘 가치가 있었다.
 */
class OpenAiAutoConfigWithoutKeyTest {

    @Test
    void chatModelBeanCreationDoesNotFailWhenApiKeyBlank() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(
                        ToolCallingAutoConfiguration.class, OpenAiChatAutoConfiguration.class))
                .withPropertyValues(
                        "spring.ai.openai.api-key=",
                        "spring.ai.openai.base-url=http://localhost:9999/v1",
                        "spring.ai.openai.chat.options.model=gpt-5.4-nano")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(org.springframework.ai.openai.OpenAiChatModel.class);
                });
    }
}
