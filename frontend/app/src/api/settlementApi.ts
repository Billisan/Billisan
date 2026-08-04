import type { PendingSettlementsResponse } from '../types/settlement'

type MockScenario = 'NO_RENTAL' | 'ACTIVE_RENTAL' | 'OVERDUE_UNSETTLED'

// 수동 테스트 시나리오 — rentalApi.ts의 MOCK_SCENARIO와 같은 값으로 맞춰야 화면이 일관되게 보인다.
const MOCK_SCENARIO: MockScenario = 'OVERDUE_UNSETTLED'

const MIN_DELAY_MS = 300
const MAX_DELAY_MS = 800

const SCENARIOS: Record<MockScenario, PendingSettlementsResponse> = {
  NO_RENTAL: { items: [], totalOutstandingAmount: 0, rentalEligibilityBlocked: false },
  ACTIVE_RENTAL: { items: [], totalOutstandingAmount: 0, rentalEligibilityBlocked: false },
  OVERDUE_UNSETTLED: {
    items: [
      {
        settlementId: 'mock-settlement-001',
        rentalId: 'mock-rental-002',
        reason: 'OVERDUE',
        amount: 3000,
        paidAmount: 0,
        outstandingAmount: 3000,
        status: 'PENDING',
        description: '연체료',
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      },
    ],
    totalOutstandingAmount: 3000,
    rentalEligibilityBlocked: true,
  },
}

// SETTLEMENT-001(PROJECT_GUIDE.md §5.7) 대응 Mock. 실제 네트워크 호출 없음.
export function getPendingSettlements(): Promise<PendingSettlementsResponse> {
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(SCENARIOS[MOCK_SCENARIO])
    }, delay)
  })
}
