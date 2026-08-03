import { RENTAL_BLOCK_REASON } from '../types/eligibility'
import type {
  CancelReasonCode,
  CancelResult,
  FaceAuthEvent,
  FaceAuthResult,
  KioskMode,
  RentEvent,
  RentResult,
  ReturnEvent,
  ReturnResult,
  SessionOpenResult,
  SessionStateResult,
} from '../types/piProtocol'

// 실제 Pi(piSocket.ts)가 연결 안 될 때 뒤쪽 화면(인증 이후 대여/반납 흐름)을 테스트하기 위한
// Mock. VITE_PI_MOCK=true일 때만 piSocket.ts에서 이 모듈로 위임한다 — 실제 Pi 연동 코드는
// 건드리지 않는다. stationApi.ts와 같은 방식(수동 시나리오 상수 스위치, setTimeout, 실제
// 네트워크 호출 없음)을 따른다.

// 화면 전환 테스트 속도 — 이 값만 바꾸면 아래 모든 단계 대기 시간이 같이 조절된다.
// 0으로 두면 사실상 즉시 다음 화면으로 넘어간다(네트워크 왕복 흉내가 필요 없을 때).
const STEP_DELAY_MS = 30

const MIN_DELAY_MS = STEP_DELAY_MS
const MAX_DELAY_MS = STEP_DELAY_MS

function delay<T>(value: T, ms = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

// --- KSK-AUTH-001 시나리오 — 아래 MOCK_AUTH_SCENARIO를 바꿔서 분기를 테스트 ---
const AUTH_SCENARIOS = {
  ELIGIBLE: { authenticated: true, eligible: true, blockingReasons: [] as string[] },
  UNSETTLED_BLOCKED: {
    authenticated: true,
    eligible: false,
    blockingReasons: [RENTAL_BLOCK_REASON.UNSETTLED_BLOCKED] as string[],
  },
  ACTIVE_RENTAL_EXISTS: {
    authenticated: true,
    eligible: false,
    blockingReasons: [RENTAL_BLOCK_REASON.ACTIVE_RENTAL_EXISTS] as string[],
  },
  ACTIVE_RENTAL_NOT_FOUND: {
    authenticated: true,
    eligible: false,
    blockingReasons: [RENTAL_BLOCK_REASON.ACTIVE_RENTAL_NOT_FOUND] as string[],
  },
  NOT_MATCHED: { authenticated: false, eligible: false, blockingReasons: [] as string[] },
}
const MOCK_AUTH_SCENARIO: keyof typeof AUTH_SCENARIOS = 'ELIGIBLE'

// TEMP: 실 wire 스펙(FaceAuthResult)엔 없는 필드 — 팀 결정(2026-08-03)으로 실명 확인 화면을
// 테스트하기 위해 Mock에서만 임시로 채운다.
const MOCK_DISPLAY_NAME = '홍길동'

// --- KSK-RENT-001 시나리오 ---
const MOCK_RENT_SCENARIO: 'SUCCESS' | 'FAILED' = 'SUCCESS'
const MOCK_SLOT_NUMBER = 1

// --- KSK-RETURN-001 시나리오 ---
const MOCK_RETURN_SCENARIO: 'NORMAL' | 'DAMAGED' | 'UNCERTAIN' | 'FAILED' = 'NORMAL'

export function openSession(mode: KioskMode): Promise<SessionOpenResult> {
  return delay({
    sessionId: crypto.randomUUID(),
    mode,
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  })
}

export async function startFaceAuth(
  sessionId: string,
  onEvent: (event: FaceAuthEvent) => void,
): Promise<FaceAuthResult> {
  const authRequestId = crypto.randomUUID()

  onEvent({
    sessionId,
    authRequestId,
    status: 'GUIDANCE',
    guidanceCode: 'CENTER_FACE',
    progressMode: 'INDETERMINATE',
  })
  await delay(undefined, STEP_DELAY_MS)

  onEvent({
    sessionId,
    authRequestId,
    status: 'AUTH_PROCESSING',
    guidanceCode: null,
    progressMode: 'INDETERMINATE',
  })

  const scenario = AUTH_SCENARIOS[MOCK_AUTH_SCENARIO]
  return delay({
    sessionId,
    authRequestId,
    authenticated: scenario.authenticated,
    eligibility: {
      eligible: scenario.eligible,
      blockingReasons: scenario.blockingReasons,
    },
    kioskStep: scenario.authenticated ? 'ELIGIBILITY_CHECKED' : 'AUTH_FAILED',
    userMessageCode: null,
    retryable: !scenario.authenticated,
    displayName: scenario.authenticated ? MOCK_DISPLAY_NAME : null,
  })
}

export async function startRent(
  sessionId: string,
  onEvent: (event: RentEvent) => void,
): Promise<RentResult> {
  const rentalRequestId = crypto.randomUUID()
  const checkoutSlotId = crypto.randomUUID()

  await delay(undefined, STEP_DELAY_MS)

  onEvent({
    status: 'RENT_SLOT_READY',
    kioskStep: 'RENT_PROCESSING',
    checkoutSlotId,
    slotNumber: MOCK_SLOT_NUMBER,
  })
  await delay(undefined, STEP_DELAY_MS)

  onEvent({
    status: 'WAITING_PHYSICAL_REMOVAL',
    kioskStep: 'REMOVE_UMBRELLA',
    checkoutSlotId,
    slotNumber: MOCK_SLOT_NUMBER,
  })

  if (MOCK_RENT_SCENARIO === 'FAILED') {
    return delay({
      sessionId,
      rentalRequestId,
      terminalStatus: 'FAILED',
      status: 'FAILED',
      rentalId: null,
      checkoutSlotId,
      slotNumber: MOCK_SLOT_NUMBER,
      rentalSummary: null,
      userMessageCode: 'DEVICE_COMMAND_TIMEOUT',
    })
  }

  return delay({
    sessionId,
    rentalRequestId,
    terminalStatus: 'SUCCEEDED',
    status: 'COMPLETED',
    rentalId: crypto.randomUUID(),
    checkoutSlotId,
    slotNumber: MOCK_SLOT_NUMBER,
    rentalSummary: { rentalId: crypto.randomUUID(), rentedAt: null, dueAt: null },
    userMessageCode: null,
  })
}

export async function startReturn(
  sessionId: string,
  onEvent: (event: ReturnEvent) => void,
): Promise<ReturnResult> {
  const requestId = crypto.randomUUID()
  const returnAttemptId = crypto.randomUUID()
  const returnSlotId = crypto.randomUUID()

  const emit = (partial: Partial<ReturnEvent> & Pick<ReturnEvent, 'status'>) =>
    onEvent({
      sessionId,
      requestId,
      returnAttemptId,
      rentalId: null,
      returnSlotId: null,
      slotNumber: null,
      kioskStep: partial.status,
      inspectionResult: null,
      progressMode: 'INDETERMINATE',
      userMessageCode: partial.userMessageCode ?? null,
      ...partial,
    })

  emit({ status: 'INSPECTION_GUIDE', userMessageCode: 'SHOW_UMBRELLA' })
  await delay(undefined, STEP_DELAY_MS)

  emit({ status: 'INSPECTION_PROCESSING' })
  await delay(undefined, STEP_DELAY_MS)

  emit({
    status: 'RETURN_SLOT_ASSIGNED',
    returnSlotId,
    slotNumber: MOCK_SLOT_NUMBER,
    inspectionResult: MOCK_RETURN_SCENARIO === 'FAILED' ? 'FAILED' : MOCK_RETURN_SCENARIO,
  })
  await delay(undefined, STEP_DELAY_MS)

  emit({
    status: 'WAITING_INSERTION',
    returnSlotId,
    slotNumber: MOCK_SLOT_NUMBER,
  })

  return delay({
    sessionId,
    requestId,
    returnAttemptId,
    rentalId: crypto.randomUUID(),
    returnSlotId,
    slotNumber: MOCK_SLOT_NUMBER,
    terminalStatus: 'SUCCEEDED',
    status: 'COMPLETED',
    inspectionResult: MOCK_RETURN_SCENARIO === 'FAILED' ? 'FAILED' : MOCK_RETURN_SCENARIO,
    userMessageCode: null,
  })
}

export function getSessionState(sessionId: string): Promise<SessionStateResult> {
  return delay({
    sessionId,
    mode: 'RENT',
    status: 'ACTIVE',
    kioskStep: 'RENT_PROCESSING',
    faceGuidance: null,
    eligibility: null,
    checkoutSlot: null,
    returnSlot: null,
    rentalId: null,
    returnAttemptId: null,
    returnAttemptStatus: null,
    inspectionResult: null,
    progressMode: 'INDETERMINATE',
    rentalSummary: null,
    userMessageCode: null,
    retryable: false,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  })
}

export function cancelSession(
  sessionId: string,
  reasonCode: CancelReasonCode,
): Promise<CancelResult> {
  void reasonCode
  return delay({
    sessionId,
    terminalStatus: 'CANCELLED',
    status: 'CANCELLED',
    cancelledAt: new Date().toISOString(),
  })
}
