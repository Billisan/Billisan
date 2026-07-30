// 09-screen-flow.md §3.2 SCR-KSK-AUTH-001 Variant 이름 기준.
// GUIDE는 문서에 명시된 Variant가 아니라 실제 목업(촬영 전 안내 화면) 근거로 추가.
export const AUTH_SCREEN_VARIANT = {
  GUIDE: 'GUIDE',
  FACE_CAPTURE: 'FACE_CAPTURE',
  FACE_PROCESSING: 'FACE_PROCESSING',
  FACE_NOT_DETECTED: 'FACE_NOT_DETECTED',
  FACE_NOT_MATCHED: 'FACE_NOT_MATCHED',
} as const

export type AuthScreenVariant =
  (typeof AUTH_SCREEN_VARIANT)[keyof typeof AUTH_SCREEN_VARIANT]

export const FACE_AUTH_RESULT = {
  MATCHED: 'MATCHED',
  NOT_DETECTED: 'NOT_DETECTED',
  NOT_MATCHED: 'NOT_MATCHED',
} as const

export type FaceAuthResult =
  (typeof FACE_AUTH_RESULT)[keyof typeof FACE_AUTH_RESULT]
