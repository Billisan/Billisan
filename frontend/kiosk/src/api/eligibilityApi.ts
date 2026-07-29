import {
  RENTAL_ELIGIBILITY_RESULT,
  type RentalEligibilityResult,
} from '../types/eligibility'

// 수동 테스트 시나리오 — MOCK_SCENARIO를 바꿔서 화면 분기를 확인한다.
const MOCK_SCENARIO: RentalEligibilityResult =
  RENTAL_ELIGIBILITY_RESULT.ELIGIBLE

const MIN_DELAY_MS = 300
const MAX_DELAY_MS = 800

// 09-screen-flow.md §4.1 "Spring 정책 검증" 대응 Mock. 실제 네트워크 호출 없음.
export function checkRentalEligibility(): Promise<RentalEligibilityResult> {
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_SCENARIO)
    }, delay)
  })
}
