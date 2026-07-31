import { INSPECTION_RESULT, type InspectionResult } from '../types/inspection'

// 수동 테스트 시나리오 — MOCK_SCENARIO를 바꿔서 화면 분기를 확인한다.
const MOCK_SCENARIO: InspectionResult = INSPECTION_RESULT.NORMAL

const MIN_DELAY_MS = 1000
const MAX_DELAY_MS = 2000

// PROJECT_GUIDE.md §3 Jetson Orin AI 보조 검수(YOLOv8n+PatchCore) 대응 Mock. 실제 네트워크 호출 없음.
export function inspectUmbrella(): Promise<InspectionResult> {
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_SCENARIO)
    }, delay)
  })
}
