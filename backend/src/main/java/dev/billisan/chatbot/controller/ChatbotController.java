package dev.billisan.chatbot.controller;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import dev.billisan.chatbot.dto.ChatMessageRequest;
import dev.billisan.chatbot.dto.ChatMessageResponse;
import dev.billisan.chatbot.service.ChatbotService;

/**
 * {@code POST /api/v1/chatbot/messages}(CHATBOT-001) 구현.
 *
 * <p>공개 사용자 요청은 Spring Boot가 직접 받는다 — 별도 AI 서버를 두지 않는다(CLAUDE.md
 * "챗봇" 절). {@code Authorization: Bearer <USER token>} 검증은 이 컨트롤러가 아니라
 * {@code SecurityConfig}의 실제 JWT 필터체인이 담당한다(`/api/v1/chatbot/**`는
 * {@code permitAll()} 목록에 없으므로 자동으로 인증이 필요하다) — 독립 프로토타입
 * (구 {@code chatbot-service/})에 있던 "Bearer 형식만 검사하는 자리표시자"는 여기서는
 * 불필요해서 옮기지 않았다.
 */
@RestController
@RequestMapping("/api/v1/chatbot")
public class ChatbotController {

    private final ChatbotService chatbotService;

    public ChatbotController(ChatbotService chatbotService) {
        this.chatbotService = chatbotService;
    }

    @PostMapping("/messages")
    public ResponseEntity<ChatMessageResponse> sendMessage(
            @RequestHeader("X-Request-Id") UUID requestId,
            @RequestBody ChatMessageRequest request) {
        String message = request == null ? null : request.message();
        ChatMessageResponse response = chatbotService.reply(requestId.toString(), message);
        return ResponseEntity.ok(response);
    }
}
