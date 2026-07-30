// 09-screen-flow.md §3.5 SCR-KSK-ERROR-001 Variant 이름 기준(대여 흐름에서 발생하는 2종만).
// ACTIVE_RENTAL_NOT_FOUND는 반납 흐름 전용이라 이번 범위에 포함하지 않는다.
export const RENTAL_BLOCK_REASON = {
  UNSETTLED_BLOCKED: 'UNSETTLED_BLOCKED',
  ACTIVE_RENTAL_EXISTS: 'ACTIVE_RENTAL_EXISTS',
} as const

export type RentalBlockReason =
  (typeof RENTAL_BLOCK_REASON)[keyof typeof RENTAL_BLOCK_REASON]

export const RENTAL_ELIGIBILITY_RESULT = {
  ELIGIBLE: 'ELIGIBLE',
  ...RENTAL_BLOCK_REASON,
} as const

export type RentalEligibilityResult =
  (typeof RENTAL_ELIGIBILITY_RESULT)[keyof typeof RENTAL_ELIGIBILITY_RESULT]
