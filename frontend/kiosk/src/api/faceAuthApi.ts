import { FACE_AUTH_RESULT, type FaceAuthResult } from '../types/faceAuth'

// 수동 테스트 시나리오 — MOCK_SCENARIO를 바꿔서 화면 분기를 확인한다.
const MOCK_SCENARIO: FaceAuthResult = FACE_AUTH_RESULT.MATCHED

const MIN_DELAY_MS = 800
const MAX_DELAY_MS = 1500

// KSK-AUTH-001 + KSK-SESSION-002(PROJECT_GUIDE.md §5.4) 대응 Mock. 실제 네트워크 호출 없음.
export function authenticateFace(): Promise<FaceAuthResult> {
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_SCENARIO)
    }, delay)
  })
}
