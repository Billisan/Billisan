package dev.billisan.chatbot.controller;

import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import dev.billisan.chatbot.dto.ChatCta;
import dev.billisan.chatbot.dto.ChatIntent;
import dev.billisan.chatbot.dto.ChatMessageResponse;
import dev.billisan.chatbot.dto.ChatSource;
import dev.billisan.chatbot.service.ChatbotService;
import dev.billisan.global.security.JwtAccessDeniedHandler;
import dev.billisan.global.security.JwtAuthenticationEntryPoint;
import dev.billisan.global.security.JwtAuthenticationFilter;
import dev.billisan.global.security.JwtProvider;
import dev.billisan.global.security.Role;
import dev.billisan.global.security.SecurityConfig;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * {@link ChatbotService}를 목으로 대체해 컨트롤러 배선·응답 스키마만 검증한다(비용·API 키
 * 불필요). 이 프로젝트의 실제 {@link SecurityConfig} 필터체인을 그대로 로딩해서, "Bearer
 * 형식만 검사"하던 독립 프로토타입 자리표시자가 아니라 진짜 JWT 검증으로 보호되는지까지
 * {@link JwtProvider}로 직접 발급한 토큰으로 실측 검증한다.
 */
@WebMvcTest(ChatbotController.class)
@EnableWebSecurity
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtAuthenticationEntryPoint.class,
        JwtAccessDeniedHandler.class, JwtProvider.class})
@TestPropertySource(properties = {
        "jwt.secret=test-secret-at-least-32-bytes-long-0123456789",
        "admin.cors.allowed-origins=http://localhost:3000"
})
class ChatbotControllerTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private JwtProvider jwtProvider;

    @MockitoBean
    private ChatbotService chatbotService;

    private MockMvc mockMvc;

    /**
     * {@code @WebMvcTest}의 기본 자동설정 목록에 Spring Security 자동설정이 빠져 있어(실측
     * 확인 — {@code springSecurityFilterChain} 빈은 컨텍스트에 존재하는데도 자동 주입된
     * {@code MockMvc}가 그 필터체인을 적용하지 않는 걸 진단해서 발견함), 자동 주입 대신
     * {@code springSecurity()} 컨피규어러로 직접 재구성해야 실제 JWT 인증이 검증된다.
     */
    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(springSecurity())
                .build();
    }

    private String userToken() {
        return "Bearer " + jwtProvider.generateToken(
                UUID.randomUUID().toString(), Map.of(Role.CLAIM_KEY, Role.USER.claimValue()), 3600);
    }

    @Test
    void returnsUnauthorizedWhenNoToken() throws Exception {
        mockMvc.perform(post("/api/v1/chatbot/messages")
                        .header("X-Request-Id", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"이용 요금이 얼마야?\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void returnsBadRequestWhenXRequestIdMissing() throws Exception {
        mockMvc.perform(post("/api/v1/chatbot/messages")
                        .header("Authorization", userToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"이용 요금이 얼마야?\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void returnsReplyFromServiceWithValidToken() throws Exception {
        when(chatbotService.reply(anyString(), eq("이용 요금이 얼마야?")))
                .thenReturn(ChatMessageResponse.of("24시간은 무료예요.", ChatIntent.UNSETTLED_GUIDE,
                        ChatCta.OPEN_MY_PAGE, ChatSource.EXTERNAL_LLM, false));

        mockMvc.perform(post("/api/v1/chatbot/messages")
                        .header("Authorization", userToken())
                        .header("X-Request-Id", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"이용 요금이 얼마야?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messageId").exists())
                .andExpect(jsonPath("$.answer").value("24시간은 무료예요."))
                .andExpect(jsonPath("$.intent").value("UNSETTLED_GUIDE"))
                .andExpect(jsonPath("$.action.type").value("OPEN_MY_PAGE"))
                .andExpect(jsonPath("$.action.label").value("내 정보 보기"))
                .andExpect(jsonPath("$.source").value("EXTERNAL_LLM"))
                .andExpect(jsonPath("$.fallback").value(false));
    }
}
