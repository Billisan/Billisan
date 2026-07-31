// Kiosk↔Pi WebSocket v3.0 실 wire 스펙(임베디드 제공 문서, 2026-07-31) 기준 타입.
// 이전 "12-I" 조각 정보 기반 스키마(schemaVersion/messageId/operationId/sequence 포함)는
// 이 문서로 대체됐다 — 실제 Pi 구현은 그 필드들을 쓰지 않는다.

export interface PiEnvelope<TPayload = unknown> {
  type: string
  sessionId: string | null
  requestId: string
  correlationId: string
  expiresAt: string | null
  payload: TPayload
}

export interface PiAckPayload {
  ackStatus: 'ACCEPTED' | 'REJECTED'
  acceptedAt: string
  errorCode: string | null
}

export interface PiErrorPayload {
  errorCode: string
  message: string
  retryable: boolean
}

export type KioskMode = 'RENT' | 'RETURN'

// eligibility.blockingReasons 배열의 실제 문자열 값은 임베디드 문서에 명시돼 있지 않다.
// 사용자 확인(2026-07-31): 기본적으로 미정산/활성대여류 값이 들어있다고 가정하고,
// 모르는 값은 문서 §3 원칙대로 에러 처리하지 않고 무시한다.
export interface PiEligibility {
  eligible: boolean
  blockingReasons: string[]
}

// --- KSK-STATION-001 ---
export interface StationSummaryResult {
  stationId: string
  observedAt: string
  stale: boolean
  operating: { status: 'OPEN' | 'CLOSED' | 'UNAVAILABLE'; opensAt: string | null; closesAt: string | null }
  inventory: { rentableSlotCount: number; emptyReturnSlotCount: number }
  availability: { rentAvailable: boolean; returnAvailable: boolean; blockingReasons: string[] }
}

// --- KSK-SESSION-001 ---
export interface SessionOpenResult {
  sessionId: string
  mode: KioskMode
  status: string
  expiresAt: string
}

// --- KSK-AUTH-001 ---
export interface FaceAuthEvent {
  sessionId: string
  authRequestId: string
  status: 'AUTH_PROCESSING' | 'GUIDANCE'
  guidanceCode: 'NONE' | 'CENTER_FACE' | null
  progressMode: 'INDETERMINATE'
}

export interface FaceAuthResult {
  sessionId: string
  authRequestId: string
  authenticated: boolean
  eligibility: PiEligibility
  kioskStep: string
  userMessageCode: string | null
  retryable: boolean
}

// --- KSK-RENT-001 ---
export interface RentEvent {
  status: 'RENT_SLOT_READY' | 'WAITING_PHYSICAL_REMOVAL'
  kioskStep: string
  checkoutSlotId: string | null
  slotNumber: number | null
}

export interface RentResult {
  sessionId: string
  rentalRequestId: string
  terminalStatus: 'SUCCEEDED' | 'FAILED'
  status: string
  rentalId: string | null
  checkoutSlotId: string | null
  slotNumber: number | null
  rentalSummary: { rentalId: string; rentedAt: string | null; dueAt: string | null } | null
  userMessageCode: string | null
}

// --- KSK-RETURN-001 ---
export interface ReturnEvent {
  sessionId: string
  requestId: string
  returnAttemptId: string | null
  rentalId: string | null
  returnSlotId: string | null
  slotNumber: number | null
  status:
    | 'INSPECTION_GUIDE'
    | 'INSPECTION_PROCESSING'
    | 'RETURN_SLOT_ASSIGNED'
    | 'WAITING_INSERTION'
    | 'SPRING_COMMITTING'
  kioskStep: string
  inspectionResult: 'NORMAL' | 'DAMAGED' | 'UNCERTAIN' | 'FAILED' | null
  progressMode: 'INDETERMINATE'
  userMessageCode: string | null
}

export interface ReturnResult {
  sessionId: string
  requestId: string
  returnAttemptId: string
  rentalId: string
  returnSlotId: string
  slotNumber: number
  terminalStatus: 'SUCCEEDED' | 'FAILED'
  status: string
  inspectionResult: 'NORMAL' | 'DAMAGED' | 'UNCERTAIN' | 'FAILED'
  userMessageCode: string | null
}

// --- KSK-SESSION-002 ---
export interface SessionStateResult {
  sessionId: string
  mode: KioskMode
  status: string
  kioskStep: string
  faceGuidance: string | null
  eligibility: PiEligibility | null
  checkoutSlot: { slotId: string; slotNumber: number } | null
  returnSlot: { slotId: string; slotNumber: number } | null
  rentalId: string | null
  returnAttemptId: string | null
  returnAttemptStatus: string | null
  inspectionResult: 'NORMAL' | 'DAMAGED' | 'UNCERTAIN' | 'FAILED' | null
  progressMode: 'INDETERMINATE'
  rentalSummary: { rentalId: string; rentedAt: string | null; dueAt: string | null } | null
  userMessageCode: string | null
  retryable: boolean
  expiresAt: string
}

// --- KSK-CANCEL-001 ---
export type CancelReasonCode = 'USER_CANCELLED' | 'SCREEN_EXIT' | 'OPERATOR_CANCELLED'

export interface CancelResult {
  sessionId: string
  terminalStatus: 'CANCELLED'
  status: 'CANCELLED'
  cancelledAt: string
}
