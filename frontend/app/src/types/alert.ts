// ALERT-001(PROJECT_GUIDE.md §5.11) 응답 원문 그대로 — 임의로 새 값을 추가하지 않는다.
export const ALERT_TYPE = {
  RENTAL_DUE_SOON: 'RENTAL_DUE_SOON',
  UNSETTLED: 'UNSETTLED',
  RETURN_COMPLETED: 'RETURN_COMPLETED',
  ADMIN_REVIEW: 'ADMIN_REVIEW',
  RECOVERY_REQUIRED: 'RECOVERY_REQUIRED',
} as const

export type AlertType = (typeof ALERT_TYPE)[keyof typeof ALERT_TYPE]

// §5.11 action.type 3종 — 이 외 값은 임의로 추가하지 않는다.
export const ALERT_ACTION_TYPE = {
  OPEN_MY_PAGE: 'OPEN_MY_PAGE',
  OPEN_HISTORY: 'OPEN_HISTORY',
  NONE: 'NONE',
} as const

export type AlertActionType = (typeof ALERT_ACTION_TYPE)[keyof typeof ALERT_ACTION_TYPE]

// read는 §5.11 원문상 P0에서 "App 로컬 상태"라 이 타입엔 넣지 않는다 — 화면이 세션 로컬로 관리.
export interface AlertItem {
  alertKey: string
  type: AlertType
  title: string
  message: string
  occurredAt: string
  action: { type: AlertActionType; targetId: string | null }
}
