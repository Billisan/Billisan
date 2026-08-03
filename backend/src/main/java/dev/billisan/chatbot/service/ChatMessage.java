package dev.billisan.chatbot.service;

/** OpenAI 호환 chat completions API의 메시지 1개(role/content). 요청·응답 공용. */
record ChatMessage(String role, String content) {
}
