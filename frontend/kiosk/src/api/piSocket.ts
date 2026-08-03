import * as mock from './piSocket.mock'
import type {
  CancelReasonCode,
  CancelResult,
  FaceAuthEvent,
  FaceAuthResult,
  KioskMode,
  PiAckPayload,
  PiEnvelope,
  PiErrorPayload,
  RentEvent,
  RentResult,
  ReturnEvent,
  ReturnResult,
  SessionOpenResult,
  SessionStateResult,
  StationSummaryResult,
} from '../types/piProtocol'

// Kiosk↔Pi WebSocket v3.0 실 wire 스펙(임베디드 문서, 2026-07-31) 대응.
// 구형(플로우당 재연결·flat {stage} 메시지) 구현을 전부 대체한다 — 이제 지속 연결 1개로
// 세션 열기 → 인증 → 대여/반납까지 순차 처리한다(문서 §3 "한 연결에서 Operation은 순차 처리").
const PI_WS_URL = import.meta.env.VITE_PI_WS_URL

// 실 Pi가 연결 안 될 때 뒤쪽 화면 테스트용 — .env.local에 VITE_PI_MOCK=true로만 켠다.
// 실제 Pi 연동 로직(아래 request/connect)은 건드리지 않고 각 export 진입점에서만 위임한다.
const USE_MOCK = import.meta.env.VITE_PI_MOCK === 'true'

export class PiOperationError extends Error {
  errorCode: string
  retryable: boolean

  constructor(payload: PiErrorPayload) {
    super(payload.message || payload.errorCode)
    this.errorCode = payload.errorCode
    this.retryable = payload.retryable
  }
}

interface PendingHandlers {
  onEvent?: (payload: unknown) => void
  onResult: (payload: unknown) => void
  onError: (error: PiOperationError) => void
}

let socket: WebSocket | null = null
let connecting: Promise<WebSocket> | null = null
const pending = new Map<string, PendingHandlers>()

function connect(): Promise<WebSocket> {
  if (socket && socket.readyState === WebSocket.OPEN) return Promise.resolve(socket)
  if (connecting) return connecting

  connecting = new Promise((resolve, reject) => {
    const ws = new WebSocket(PI_WS_URL)

    ws.onopen = () => {
      socket = ws
      connecting = null
      resolve(ws)
    }

    ws.onmessage = (event) => {
      let message: PiEnvelope
      try {
        message = JSON.parse(event.data)
      } catch {
        console.error('[Pi WS] 메시지 파싱 실패', event.data)
        return
      }
      handleMessage(message)
    }

    ws.onerror = (event) => {
      connecting = null
      reject(event)
    }

    ws.onclose = (event) => {
      console.log('[Pi WS] close', event.code, event.reason)
      socket = null
      connecting = null
    }
  })

  return connecting
}

function handleMessage(message: PiEnvelope) {
  const handlers = pending.get(message.requestId)
  if (!handlers) {
    // 문서 §3 "전방 호환": 대응하는 요청이 없는 메시지(중복 EVENT 등)는 에러 없이 무시.
    console.log('[Pi WS] 대응 요청 없는 메시지, 무시', message)
    return
  }

  if (message.type === 'KIOSK.OPERATION.ERROR') {
    pending.delete(message.requestId)
    handlers.onError(new PiOperationError(message.payload as PiErrorPayload))
    return
  }

  if (message.type.endsWith('.ACK')) {
    const ack = message.payload as PiAckPayload
    if (ack.ackStatus === 'REJECTED') {
      pending.delete(message.requestId)
      handlers.onError(
        new PiOperationError({
          errorCode: ack.errorCode ?? 'UNKNOWN',
          message: 'ACK REJECTED',
          retryable: false,
        }),
      )
    }
    // ACCEPTED는 "접수됨"일 뿐 — 문서 §2 "RESULT 수신 전 성공 표시 금지". 별도 처리 없음.
    return
  }

  if (message.type.endsWith('.EVENT')) {
    handlers.onEvent?.(message.payload)
    return
  }

  if (message.type.endsWith('.RESULT')) {
    pending.delete(message.requestId)
    handlers.onResult(message.payload)
    return
  }

  // 문서 §3 "전방 호환": 모르는 type은 에러 처리하지 않고 무시.
  console.log('[Pi WS] 알 수 없는 type, 무시', message.type)
}

function request<TPayload, TResult>(
  type: string,
  sessionId: string | null,
  payload: TPayload,
  onEvent?: (payload: unknown) => void,
): Promise<TResult> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID()
    const envelope: PiEnvelope<TPayload> = {
      type,
      sessionId,
      requestId,
      correlationId: crypto.randomUUID(),
      expiresAt: null,
      payload,
    }

    pending.set(requestId, {
      onEvent,
      onResult: (result) => resolve(result as TResult),
      onError: (error) => reject(error),
    })

    connect()
      .then((ws) => ws.send(JSON.stringify(envelope)))
      .catch((error: unknown) => {
        pending.delete(requestId)
        reject(
          error instanceof PiOperationError
            ? error
            : new PiOperationError({
                errorCode: 'KIOSK_WEBSOCKET_UNAVAILABLE',
                message: String(error),
                retryable: true,
              }),
        )
      })
  })
}

const CLIENT_SESSION_KEY_STORAGE_KEY = 'billisan_kiosk_client_session_key'

// 사용자 식별 정보가 아닌 브라우저 세션 한정 키 — Web Crypto로 생성해 sessionStorage에만 보관.
function getClientSessionKey(): string {
  const existing = sessionStorage.getItem(CLIENT_SESSION_KEY_STORAGE_KEY)
  if (existing) return existing

  const key = crypto.randomUUID()
  sessionStorage.setItem(CLIENT_SESSION_KEY_STORAGE_KEY, key)
  return key
}

// KSK-STATION-001
export function getStationSummary(): Promise<StationSummaryResult> {
  return request('KIOSK.STATION_SUMMARY.REQUEST', null, { stationId: null })
}

// KSK-SESSION-001 — 항상 이 흐름의 첫 Operation. Envelope sessionId=null로 보낸다.
export function openSession(mode: KioskMode): Promise<SessionOpenResult> {
  if (USE_MOCK) return mock.openSession(mode)
  return request('KIOSK.SESSION.OPEN.REQUEST', null, {
    mode,
    stationId: null,
    clientSessionKey: getClientSessionKey(),
    lastKnownSessionId: null,
    operationRequestIds: {
      faceAuthRequestId: null,
      rentalRequestId: null,
      returnRequestId: null,
    },
  })
}

// KSK-AUTH-001
export function startFaceAuth(
  sessionId: string,
  onEvent: (event: FaceAuthEvent) => void,
): Promise<FaceAuthResult> {
  if (USE_MOCK) return mock.startFaceAuth(sessionId, onEvent)
  const authRequestId = crypto.randomUUID()
  return request(
    'KIOSK.FACE_AUTH.REQUEST',
    sessionId,
    { authRequestId },
    onEvent as (payload: unknown) => void,
  )
}

// KSK-RENT-001
export function startRent(
  sessionId: string,
  onEvent: (event: RentEvent) => void,
): Promise<RentResult> {
  if (USE_MOCK) return mock.startRent(sessionId, onEvent)
  const rentalRequestId = crypto.randomUUID()
  return request(
    'KIOSK.RENT.REQUEST',
    sessionId,
    { rentalRequestId },
    onEvent as (payload: unknown) => void,
  )
}

// KSK-RETURN-001 — 멱등 키는 payload가 아니라 Envelope requestId 자체(문서 §4.5).
export function startReturn(
  sessionId: string,
  onEvent: (event: ReturnEvent) => void,
): Promise<ReturnResult> {
  if (USE_MOCK) return mock.startReturn(sessionId, onEvent)
  return request(
    'KIOSK.RETURN.REQUEST',
    sessionId,
    {},
    onEvent as (payload: unknown) => void,
  )
}

// KSK-SESSION-002 — 재연결·복구용 상태 조회. 상태 변경 없음, 여러 번 호출해도 안전.
export function getSessionState(sessionId: string): Promise<SessionStateResult> {
  if (USE_MOCK) return mock.getSessionState(sessionId)
  return request('KIOSK.SESSION.STATE.REQUEST', sessionId, {})
}

// KSK-CANCEL-001
export function cancelSession(
  sessionId: string,
  reasonCode: CancelReasonCode,
): Promise<CancelResult> {
  if (USE_MOCK) return mock.cancelSession(sessionId, reasonCode)
  return request('KIOSK.SESSION.CANCEL.REQUEST', sessionId, { reasonCode })
}
