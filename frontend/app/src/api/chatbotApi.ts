import { apiClient } from './client'
import type { ChatbotMessageRequest, ChatbotMessageResponse } from '../types/chatbot'

// CHATBOT-001(PROJECT_GUIDE.md §5.13).
export async function sendChatbotMessage(
  request: ChatbotMessageRequest,
): Promise<ChatbotMessageResponse> {
  const response = await apiClient.post<ChatbotMessageResponse>('/api/v1/chatbot/messages', request)
  return response.data
}
