// PROJECT_GUIDE.md §6 "반납 결과 표현 규칙" / PHASE.md Phase 3 "AI 결과 정책" 기준.
export const INSPECTION_RESULT = {
  NORMAL: 'NORMAL',
  DAMAGED: 'DAMAGED',
  UNCERTAIN: 'UNCERTAIN',
  FAILED: 'FAILED',
} as const

export type InspectionResult =
  (typeof INSPECTION_RESULT)[keyof typeof INSPECTION_RESULT]
