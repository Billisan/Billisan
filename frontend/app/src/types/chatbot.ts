// CHATBOT-001(PROJECT_GUIDE.md §5.13) 요청/응답 원문 그대로 — 임의로 새 값을 추가하지 않는다.
export const CHATBOT_INTENT = {
  RENTAL_GUIDE: 'RENTAL_GUIDE',
  RETURN_GUIDE: 'RETURN_GUIDE',
  EXTENSION_GUIDE: 'EXTENSION_GUIDE',
  LOSS_OR_DAMAGE_GUIDE: 'LOSS_OR_DAMAGE_GUIDE',
  UNSETTLED_GUIDE: 'UNSETTLED_GUIDE',
  STATION_GUIDE: 'STATION_GUIDE',
  GENERAL_INQUIRY: 'GENERAL_INQUIRY',
} as const

export type ChatbotIntent = (typeof CHATBOT_INTENT)[keyof typeof CHATBOT_INTENT]

// 허용 CTA 5종(PROJECT_GUIDE.md §6) — 이 외 값은 임의로 추가하지 않는다.
export const CHATBOT_ACTION_TYPE = {
  OPEN_MAP: 'OPEN_MAP',
  OPEN_MY_PAGE: 'OPEN_MY_PAGE',
  OPEN_HISTORY: 'OPEN_HISTORY',
  OPEN_INQUIRY: 'OPEN_INQUIRY',
  NONE: 'NONE',
} as const

export type ChatbotActionType = (typeof CHATBOT_ACTION_TYPE)[keyof typeof CHATBOT_ACTION_TYPE]

export const CHATBOT_SOURCE = {
  STATIC_FAQ: 'STATIC_FAQ',
  EXTERNAL_LLM: 'EXTERNAL_LLM',
  STATIC_FAQ_FALLBACK: 'STATIC_FAQ_FALLBACK',
} as const

export type ChatbotSource = (typeof CHATBOT_SOURCE)[keyof typeof CHATBOT_SOURCE]

export interface ChatbotMessageRequest {
  requestId: string
  message: string
  screenContext?: string | null
  clientContext?: {
    hasActiveRental?: boolean
    hasPendingSettlement?: boolean
  }
}

export interface ChatbotMessageResponse {
  messageId: string
  answer: string
  intent: ChatbotIntent
  action: { type: ChatbotActionType; label: string }
  source: ChatbotSource
  fallback: boolean
}

// §5.13 오류 코드 원문 — Mock에서는 TIMEOUT/ERROR 시나리오 표시용으로만 사용.
export const CHATBOT_ERROR_CODE = {
  CHATBOT_MESSAGE_REQUIRED: 'CHATBOT_MESSAGE_REQUIRED',
  CHATBOT_MESSAGE_TOO_LONG: 'CHATBOT_MESSAGE_TOO_LONG',
  CHATBOT_UNSAFE_INPUT: 'CHATBOT_UNSAFE_INPUT',
  CHATBOT_RATE_LIMITED: 'CHATBOT_RATE_LIMITED',
  CHATBOT_PROVIDER_UNAVAILABLE: 'CHATBOT_PROVIDER_UNAVAILABLE',
  CHATBOT_PROVIDER_TIMEOUT: 'CHATBOT_PROVIDER_TIMEOUT',
  CHATBOT_RESPONSE_FAILED: 'CHATBOT_RESPONSE_FAILED',
} as const

export type ChatbotErrorCode = (typeof CHATBOT_ERROR_CODE)[keyof typeof CHATBOT_ERROR_CODE]
