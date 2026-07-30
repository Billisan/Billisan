// KSK-STATION-001(PROJECT_GUIDE.md §5.4) 응답 계약을 미러링한 타입.
// 실제 서버 스키마는 미확인 상태(PROJECT_GUIDE.md §13.4) — observedAt/stale 필드명만 문서 근거 있음.
export interface StationSummary {
  usableSlotCount: number // 빌릴 수 있는 우산 개수
  returnableSlotCount: number // 반납 가능한 우산함(빈 슬롯) 개수 — 문서 근거 없음, 목업 반영용 임시 필드
  observedAt: string // 이 숫자를 언제 쟀는지 (시각)
  stale: boolean // 이 숫자가 오래돼서 못 믿을 수도 있다는 표시(true/false)
}

export const MAIN_SCREEN_VARIANT = {
  DEFAULT: 'DEFAULT',
  RENT_DISABLED_NO_STOCK: 'RENT_DISABLED_NO_STOCK',
} as const

export type MainScreenVariant =
  (typeof MAIN_SCREEN_VARIANT)[keyof typeof MAIN_SCREEN_VARIANT]
