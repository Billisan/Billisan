// SETTLEMENT-001 응답 (PROJECT_GUIDE.md §5.7) 그대로.
export type SettlementReason = 'OVERDUE' | 'LOSS' | 'DAMAGE' | 'ADJUSTMENT'
export type SettlementStatus = 'PENDING' | 'PAID' | 'CANCELLED'

export interface PendingSettlementItem {
  settlementId: string
  rentalId: string
  reason: SettlementReason
  amount: number
  paidAmount: number
  outstandingAmount: number
  status: SettlementStatus
  description: string
  createdAt: string
}

export interface PendingSettlementsResponse {
  items: PendingSettlementItem[]
  totalOutstandingAmount: number
  rentalEligibilityBlocked: boolean
}
