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
// 원칙적으로 이름·학번·UUID 같은 사용자 식별정보는 이 타입에 포함하지 않는다.
export interface KioskStageMessage {
  stage: KioskStage
  message?: string
  eligible?: boolean
  reasonCode?: EligibilityReasonCode
  sessionId?: string
  // TEMP 예외: 09-screen-flow.md §1은 얼굴 인증 중 이름 표시를 명시적으로 금지하지만,
  // 팀 결정(2026-08-03)으로 AuthSuccessScreen에 실명 확인 단계를 추가하기로 하면서
  // AUTH_SUCCEEDED stage에 한해 displayName을 임시로 실어 보낸다. 명세서는 아직 갱신 전.
  displayName?: string | null
}
