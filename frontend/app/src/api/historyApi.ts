import type { HistoryStatusFilter, RentalHistoryItem, RentalHistoryResponse } from '../types/history'
import { RENTAL_STATUS } from '../types/rental'

interface GetRentalHistoryParams {
  status?: HistoryStatusFilter
  cursor?: string | null
  size?: number
}

type MockScenario = 'WITH_ITEMS' | 'EMPTY'

// 수동 테스트 시나리오 — 'EMPTY'로 바꾸면 이용 내역이 아예 없는 예외 화면(HistoryScreen.tsx)을 확인할 수 있다.
const MOCK_SCENARIO: MockScenario = 'EMPTY'

const MIN_DELAY_MS = 300
const MAX_DELAY_MS = 800

// 필터·상태 Chip·정산 뱃지 조합을 한 화면에서 확인할 수 있도록 상태별 1건씩 구성.
// 대여 기한은 1일(24시간) 고정(2026-08-05 사용자 확인, DEC-SF-005 해소) — dueAt은 항상 rentedAt+24h.
const MOCK_ITEMS: RentalHistoryItem[] = [
  {
    rentalId: 'mock-history-001',
    status: RENTAL_STATUS.ACTIVE,
    checkoutStationName: '중앙도서관 1층',
    returnStationName: null,
    rentedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    endedAt: null,
    dueAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
    settlementAmount: 0,
    settlementStatus: null,
    failureCode: null,
    failedAt: null,
  },
  {
    rentalId: 'mock-history-002',
    status: RENTAL_STATUS.COMPLETED,
    checkoutStationName: '학생회관 앞',
    returnStationName: '학생회관 앞',
    rentedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    endedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
    dueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    settlementAmount: 0,
    settlementStatus: null,
    failureCode: null,
    failedAt: null,
  },
  {
    rentalId: 'mock-history-003',
    status: RENTAL_STATUS.COMPLETED,
    checkoutStationName: '공학관 1호관',
    returnStationName: '중앙도서관 1층',
    rentedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    // 기한(rentedAt+24h)보다 늦게 반납 → 연체료 발생, 미정산으로 남은 케이스.
    endedAt: new Date(Date.now() - 5.5 * 24 * 60 * 60 * 1000).toISOString(),
    dueAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    settlementAmount: 1000,
    settlementStatus: 'PENDING',
    failureCode: null,
    failedAt: null,
  },
  {
    rentalId: 'mock-history-004',
    status: RENTAL_STATUS.LOST,
    checkoutStationName: '기숙사 정문',
    returnStationName: null,
    rentedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    endedAt: null,
    dueAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(),
    settlementAmount: 7000,
    settlementStatus: 'PAID',
    failureCode: null,
    failedAt: null,
  },
  {
    rentalId: 'mock-history-005',
    status: RENTAL_STATUS.FAILED,
    checkoutStationName: '중앙도서관 1층',
    returnStationName: null,
    rentedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    endedAt: null,
    dueAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    settlementAmount: 0,
    settlementStatus: null,
    failureCode: 'SLOT_LOCK_TIMEOUT',
    failedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

// RENTAL-002(PROJECT_GUIDE.md §5.6) 대응 Mock. 실제 네트워크 호출 없음.
// 페이지네이션 UI 자체는 이번 Phase 범위 밖이라 nextCursor는 항상 null(app-screen-flow.md §2.6).
export function getRentalHistory({ status = 'ALL' }: GetRentalHistoryParams = {}): Promise<RentalHistoryResponse> {
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)
  const source = MOCK_SCENARIO === 'EMPTY' ? [] : MOCK_ITEMS
  const items = status === 'ALL' ? source : source.filter((item) => item.status === status)

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ items, nextCursor: null })
    }, delay)
  })
}
