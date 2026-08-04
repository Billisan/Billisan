import type { CurrentRentalDetail } from '../types/rental'
import { RENTAL_STATUS } from '../types/rental'

type MockScenario = 'NO_RENTAL' | 'ACTIVE_RENTAL' | 'OVERDUE_UNSETTLED'

// 수동 테스트 시나리오 — MOCK_SCENARIO를 바꿔서 대여 없음/대여중/연체 화면을 확인한다.
// settlementApi.ts의 MOCK_SCENARIO와 같은 값으로 맞춰야 마이페이지 화면이 일관되게 보인다.
const MOCK_SCENARIO: MockScenario = 'ACTIVE_RENTAL'

const MIN_DELAY_MS = 300
const MAX_DELAY_MS = 800

const SCENARIOS: Record<MockScenario, CurrentRentalDetail | null> = {
  NO_RENTAL: null,
  ACTIVE_RENTAL: {
    rentalId: 'mock-rental-001',
    status: RENTAL_STATUS.ACTIVE,
    checkoutSlotId: 'mock-slot-001',
    checkoutSlotNumber: 1,
    checkoutStation: { stationId: 'mock-station-001', name: '학생회관 대여소' },
    rentedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    dueAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    overdueDays: 0,
    calculatedOverdueAmount: 0,
    latestReturnAttempt: null,
    failureCode: null,
    failedAt: null,
  },
  OVERDUE_UNSETTLED: {
    rentalId: 'mock-rental-002',
    status: RENTAL_STATUS.ACTIVE,
    checkoutSlotId: 'mock-slot-002',
    checkoutSlotNumber: 2,
    checkoutStation: { stationId: 'mock-station-001', name: '학생회관 대여소' },
    rentedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    dueAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    overdueDays: 1,
    calculatedOverdueAmount: 3000,
    latestReturnAttempt: null,
    failureCode: null,
    failedAt: null,
  },
}

// RENTAL-001(PROJECT_GUIDE.md §5.5) 대응 Mock. 실제 네트워크 호출 없음.
export function getCurrentRental(): Promise<CurrentRentalDetail | null> {
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(SCENARIOS[MOCK_SCENARIO])
    }, delay)
  })
}
