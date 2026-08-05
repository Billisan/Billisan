import {
  CHATBOT_ACTION_TYPE,
  CHATBOT_ERROR_CODE,
  CHATBOT_INTENT,
  CHATBOT_SOURCE,
} from '../types/chatbot'
import type { ChatbotMessageRequest, ChatbotMessageResponse } from '../types/chatbot'

// 수동 테스트 시나리오 — MOCK_SCENARIO를 바꿔서 정상/폴백/타임아웃/에러 화면을 확인한다.
const MOCK_SCENARIO: 'SUCCESS' | 'FALLBACK' | 'TIMEOUT' | 'ERROR' = 'SUCCESS'

const MIN_DELAY_MS = 400
const MAX_DELAY_MS = 900

// P0 지원 Intent 6종(PROJECT_GUIDE.md §6) 키워드 매칭 — 실제 외부 LLM 호출 없음.
function matchIntent(message: string): Omit<ChatbotMessageResponse, 'messageId' | 'source' | 'fallback'> {
  if (message.includes('분실') || message.includes('파손')) {
    return {
      answer: '우산을 분실했거나 파손됐다면 마이페이지의 현재 대여 카드에서 신고할 수 있어요.',
      intent: CHATBOT_INTENT.LOSS_OR_DAMAGE_GUIDE,
      action: { type: CHATBOT_ACTION_TYPE.OPEN_MY_PAGE, label: '마이페이지에서 신고하기' },
    }
  }
  if (message.includes('정산') || message.includes('결제')) {
    return {
      answer: '미정산 금액이 있다면 마이페이지에서 바로 결제할 수 있어요.',
      intent: CHATBOT_INTENT.UNSETTLED_GUIDE,
      action: { type: CHATBOT_ACTION_TYPE.OPEN_MY_PAGE, label: '마이페이지에서 결제하기' },
    }
  }
  if (message.includes('대여소') || message.includes('지도') || message.includes('위치')) {
    return {
      answer: '가까운 대여소는 지도에서 확인할 수 있어요.',
      intent: CHATBOT_INTENT.STATION_GUIDE,
      action: { type: CHATBOT_ACTION_TYPE.OPEN_MAP, label: '대여소 지도 열기' },
    }
  }
  if (message.includes('연장')) {
    return {
      answer: '대여 기간은 마이페이지의 현재 대여 카드에서 1회 연장할 수 있어요.',
      intent: CHATBOT_INTENT.EXTENSION_GUIDE,
      action: { type: CHATBOT_ACTION_TYPE.NONE, label: '' },
    }
  }
  if (message.includes('반납')) {
    return {
      answer: '가까운 대여소 슬롯에 우산을 꽂으면 자동으로 반납 처리돼요.',
      intent: CHATBOT_INTENT.RETURN_GUIDE,
      action: { type: CHATBOT_ACTION_TYPE.NONE, label: '' },
    }
  }
  if (message.includes('대여')) {
    return {
      answer: '대여소 슬롯에서 우산을 꺼내면 바로 대여가 시작돼요.',
      intent: CHATBOT_INTENT.RENTAL_GUIDE,
      action: { type: CHATBOT_ACTION_TYPE.NONE, label: '' },
    }
  }
  return {
    answer: '문의하신 내용은 담당자 확인이 필요해요. 문의하기로 남겨주시면 답변드릴게요.',
    intent: CHATBOT_INTENT.GENERAL_INQUIRY,
    action: { type: CHATBOT_ACTION_TYPE.OPEN_INQUIRY, label: '문의하기' },
  }
}

// CHATBOT-001(PROJECT_GUIDE.md §5.13) 대응 Mock. 실제 외부 LLM 호출 없음.
export function sendChatbotMessage(request: ChatbotMessageRequest): Promise<ChatbotMessageResponse> {
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (MOCK_SCENARIO === 'TIMEOUT') {
        reject(new Error(CHATBOT_ERROR_CODE.CHATBOT_PROVIDER_TIMEOUT))
        return
      }
      if (MOCK_SCENARIO === 'ERROR') {
        reject(new Error(CHATBOT_ERROR_CODE.CHATBOT_RESPONSE_FAILED))
        return
      }

      const matched = matchIntent(request.message)
      const fallback = MOCK_SCENARIO === 'FALLBACK'

      resolve({
        messageId: `mock-message-${Date.now()}`,
        ...matched,
        source: fallback ? CHATBOT_SOURCE.STATIC_FAQ_FALLBACK : CHATBOT_SOURCE.STATIC_FAQ,
        fallback,
      })
    }, delay)
  })
}
