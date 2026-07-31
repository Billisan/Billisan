// 09-screen-flow.md §3.2 SCR-KSK-AUTH-001 Variant 이름 기준.
// GUIDE는 문서에 명시된 Variant가 아니라 실제 목업(촬영 전 안내 화면) 근거로 추가.
// AUTH_SUCCESS도 문서엔 없는 로컬 연출 단계 — 인증 성공 체크 아이콘을 잠깐 보여준 뒤
// FACE_PROCESSING(환영합니다!)으로 넘어간다(faceAuthStore.ts 타이밍 참고).
export const AUTH_SCREEN_VARIANT = {
  GUIDE: 'GUIDE',
  FACE_CAPTURE: 'FACE_CAPTURE',
  AUTH_SUCCESS: 'AUTH_SUCCESS',
  FACE_PROCESSING: 'FACE_PROCESSING',
  FACE_NOT_DETECTED: 'FACE_NOT_DETECTED',
  FACE_NOT_MATCHED: 'FACE_NOT_MATCHED',
} as const

export type AuthScreenVariant =
  (typeof AUTH_SCREEN_VARIANT)[keyof typeof AUTH_SCREEN_VARIANT]
