import type { StationSummary } from '../types/slot'

type StockScenario = Pick<
  StationSummary,
  'usableSlotCount' | 'returnableSlotCount' | 'stale'
>

// 수동 테스트 시나리오 — MOCK_SCENARIO를 아래 중 하나로 바꿔서 화면 분기를 확인한다.
const SCENARIOS: Record<'AVAILABLE' | 'EMPTY' | 'STALE', StockScenario> = {
  AVAILABLE: { usableSlotCount: 2, returnableSlotCount: 3, stale: false },
  EMPTY: { usableSlotCount: 0, returnableSlotCount: 2, stale: false },
  STALE: { usableSlotCount: 3, returnableSlotCount: 2, stale: true },
}

const MOCK_SCENARIO: StockScenario = SCENARIOS.AVAILABLE

const MIN_DELAY_MS = 300
const MAX_DELAY_MS = 800

// KSK-STATION-001(PROJECT_GUIDE.md §5.4) 대응 Mock. 실제 네트워크 호출 없음.
export function fetchStationSummary(): Promise<StationSummary> {
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ ...MOCK_SCENARIO, observedAt: new Date().toISOString() })
    }, delay)
  })
}
