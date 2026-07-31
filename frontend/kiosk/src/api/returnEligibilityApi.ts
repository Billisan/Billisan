import { RENTAL_BLOCK_REASON } from '../types/eligibility'

type ActiveRentalCheckResult =
  | 'FOUND'
  | typeof RENTAL_BLOCK_REASON.ACTIVE_RENTAL_NOT_FOUND

// 수동 테스트 시나리오 — MOCK_SCENARIO를 바꿔서 화면 분기를 확인한다.
const MOCK_SCENARIO: ActiveRentalCheckResult = 'FOUND'

const MIN_DELAY_MS = 300
const MAX_DELAY_MS = 800

// 09-screen-flow.md §4.1 "활성 대여 확인" 대응 Mock. 실제 네트워크 호출 없음.
export function checkActiveRentalForReturn(): Promise<ActiveRentalCheckResult> {
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_SCENARIO)
    }, delay)
  })
}
