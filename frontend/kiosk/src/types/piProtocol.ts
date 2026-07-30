// Kiosk↔Pi WebSocket v3.0 논리 Operation의 공통 Envelope. 필드 11개는 사용자가 공유한
// v3.0 활성 계약 원문 기준(문서 원본 링크 없음, 대화로 전달받은 조각들을 옮김 — 재확인 필요).
export interface PiEnvelope<TPayload = unknown> {
  schemaVersion: '1.0'
  messageType: string
  messageId: string
  operationId: string
  sessionId: string | null
  requestId: string
  correlationId: string
  sentAt: string
  expiresAt: string
  sequence: number
  payload: TPayload
}
