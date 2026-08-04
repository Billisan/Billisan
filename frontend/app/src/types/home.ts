import type { RentalStatus } from './rental'

// HOME-001 응답 (PROJECT_GUIDE.md §5.4) 그대로.
export interface CurrentRentalSummary {
  rentalId: string
  status: RentalStatus
  checkoutStationName: string
  rentedAt: string
  dueAt: string
  overdue: boolean
  remainingFreeSeconds: number
}

export interface PendingSettlementSummary {
  count: number
  totalAmount: number
}

export interface HomeSummary {
  user: {
    displayName: string
    schoolName: string
  }
  currentRental: CurrentRentalSummary | null
  pendingSettlement: PendingSettlementSummary
  alertCount: number
}
