import type { InquiryRequest, InquiryResponse } from '../types/inquiry'

// 수동 테스트 시나리오 — MOCK_SCENARIO를 바꿔서 성공/실패 화면을 확인한다.
const MOCK_SCENARIO: 'SUCCESS' | 'SERVER_ERROR' = 'SUCCESS'

const MIN_DELAY_MS = 300
const MAX_DELAY_MS = 800

// INQUIRY-001 잠정 Mock(types/inquiry.ts 주석 참고 — 12-R 미확정, 계약 아님). 실제 네트워크 호출 없음.
export function submitInquiry(request: InquiryRequest): Promise<InquiryResponse> {
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (MOCK_SCENARIO === 'SERVER_ERROR') {
        reject(new Error('SERVER_ERROR'))
        return
      }

      resolve({
        inquiryId: 'mock-inquiry-001',
        submittedAt: new Date().toISOString(),
      })
    }, delay)
  })
}
