import type { RentalStatus } from './rental'
import type { SettlementStatus } from './settlement'

// RENTAL-002 status 쿼리(PROJECT_GUIDE.md §5.6) 원문 그대로 — 새 값 추가 금지.
export type HistoryStatusFilter = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'LOST' | 'FAILED'

// RENTAL-002 응답(PROJECT_GUIDE.md §5.6) 그대로.
export interface RentalHistoryItem {
  rentalId: string
  status: RentalStatus
  checkoutStationName: string
  returnStationName: string | null
  rentedAt: string
  endedAt: string | null
  dueAt: string
  settlementAmount: number
  settlementStatus: SettlementStatus | null
  failureCode: string | null
  failedAt: string | null
}

export interface RentalHistoryResponse {
  items: RentalHistoryItem[]
  nextCursor: string | null
}
