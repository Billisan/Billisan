import type { RentalBlockReason } from './eligibility'

export type KioskMode = 'RENT' | 'RETURN'

export const KIOSK_STAGE = {
  AUTH_STARTED: 'AUTH_STARTED',
  GUIDANCE: 'GUIDANCE',
  AUTH_SUCCEEDED: 'AUTH_SUCCEEDED',
  AUTH_FAILED: 'AUTH_FAILED',
  ELIGIBILITY_RESULT: 'ELIGIBILITY_RESULT',
} as const

export type KioskStage = (typeof KIOSK_STAGE)[keyof typeof KIOSK_STAGE]

export type EligibilityReasonCode = 'ELIGIBLE' | RentalBlockReason

// Pi 계약이 확정되기 전, Kiosk가 화면 전이에 필요한 최소 stage payload만 정의한다.
// 이름·학번·UUID 같은 사용자 식별정보는 이 타입에 포함하지 않는다.
export interface KioskStageMessage {
  stage: KioskStage
  message?: string
  eligible?: boolean
  reasonCode?: EligibilityReasonCode
}
