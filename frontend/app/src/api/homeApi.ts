import type { HomeSummary } from '../types/home'
import { RENTAL_STATUS } from '../types/rental'

type MockScenario = 'NO_RENTAL' | 'ACTIVE_RENTAL' | 'OVERDUE_UNSETTLED'

// 수동 테스트 시나리오 — MOCK_SCENARIO를 바꿔서 대여 없음/대여중/연체+미정산 화면을 확인한다.
const MOCK_SCENARIO: MockScenario = 'ACTIVE_RENTAL'

const MIN_DELAY_MS = 300
const MAX_DELAY_MS = 800

const SCENARIOS: Record<MockScenario, HomeSummary> = {
  NO_RENTAL: {
    user: { displayName: '홍길동', schoolName: '빌리대학교' },
    currentRental: null,
    pendingSettlement: { count: 0, totalAmount: 0 },
    alertCount: 0,
  },
  ACTIVE_RENTAL: {
    user: { displayName: '홍길동', schoolName: '빌리대학교' },
    currentRental: {
      rentalId: 'mock-rental-001',
      status: RENTAL_STATUS.ACTIVE,
      checkoutStationName: '중앙도서관 1층',
      rentedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      dueAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      overdue: false,
      remainingFreeSeconds: 5 * 60 * 60,
    },
    pendingSettlement: { count: 0, totalAmount: 0 },
    alertCount: 1,
  },
  OVERDUE_UNSETTLED: {
    user: { displayName: '홍길동', schoolName: '빌리대학교' },
    currentRental: {
      rentalId: 'mock-rental-002',
      status: RENTAL_STATUS.ACTIVE,
      checkoutStationName: '중앙도서관 1층',
      rentedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
      dueAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      overdue: true,
      remainingFreeSeconds: 0,
    },
    pendingSettlement: { count: 1, totalAmount: 3000 },
    alertCount: 2,
  },
}

// HOME-001(PROJECT_GUIDE.md §5.4) 대응 Mock. 실제 네트워크 호출 없음.
export function getHomeSummary(): Promise<HomeSummary> {
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(SCENARIOS[MOCK_SCENARIO])
    }, delay)
  })
}
