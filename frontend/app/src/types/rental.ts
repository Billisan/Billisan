// PROJECT_GUIDE.md §5.6(RENTAL-002 status 쿼리)·§9.2(상태 Chip 표시 규칙)에 이미 등장하는
// 값만 사용한다 — 임의로 새 상태값을 만들지 않는다(CLAUDE.md 코드 스타일 규칙).
export const RENTAL_STATUS = {
  ACTIVE: 'ACTIVE',
  RETURNING: 'RETURNING',
  COMPLETED: 'COMPLETED',
  LOST: 'LOST',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const

export type RentalStatus = (typeof RENTAL_STATUS)[keyof typeof RENTAL_STATUS]

// RENTAL-001 응답 (PROJECT_GUIDE.md §5.5) 그대로.
export interface CurrentRentalDetail {
  rentalId: string
  status: RentalStatus
  checkoutSlotId: string
  checkoutSlotNumber: number
  checkoutStation: { stationId: string; name: string }
  rentedAt: string
  dueAt: string
  overdueDays: number
  calculatedOverdueAmount: number
  latestReturnAttempt: {
    returnAttemptId: string
    status: string
    returnSlotId: string
    returnSlotNumber: number
  } | null
  failureCode: string | null
  failedAt: string | null
}
