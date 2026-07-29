// import type { PiEnvelope } from '../types/piProtocol'
//
// // DEC-032(PROJECT_GUIDE.md §9.1) 대응 — 얼굴 인증 트리거에 한해 Kiosk FE가 Pi에 직접 연결한다.
// const PI_WS_URL = import.meta.env.VITE_PI_WS_URL
//
// // TEMP: 실제 stationId 확정 전까지 임시값. 서버 응답이 오는지만 확인하는 용도(사용자 확인, 2026-07-29).
// const TEMP_STATION_ID = crypto.randomUUID()
//
// const CLIENT_SESSION_KEY_STORAGE_KEY = 'billisan_kiosk_client_session_key'
//
// // clientSessionKey는 사용자 식별 정보가 아닌 브라우저 세션 한정 키 — Web Crypto로 생성해 sessionStorage에만 보관.
// function getClientSessionKey(): string {
//   const existing = sessionStorage.getItem(CLIENT_SESSION_KEY_STORAGE_KEY)
//   if (existing) return existing
//
//   const key = crypto.randomUUID()
//   sessionStorage.setItem(CLIENT_SESSION_KEY_STORAGE_KEY, key)
//   return key
// }
//
// let sequence = 0
//
// function buildEnvelope<TPayload>(params: {
//   messageType: string
//   operationId: string
//   sessionId: string | null
//   requestId: string
//   payload: TPayload
// }): PiEnvelope<TPayload> {
//   const now = new Date()
//   const expiresAt = new Date(now.getTime() + 15_000)
//
//   return {
//     schemaVersion: '1.0',
//     messageType: params.messageType,
//     messageId: crypto.randomUUID(),
//     operationId: params.operationId,
//     sessionId: params.sessionId,
//     requestId: params.requestId,
//     correlationId: crypto.randomUUID(),
//     sentAt: now.toISOString(),
//     expiresAt: expiresAt.toISOString(),
//     sequence: sequence++,
//     payload: params.payload,
//   }
// }
//
// interface SessionOpenResult {
//   sessionId: string
//   mode: 'RENT' | 'RETURN'
//   status: string
//   expiresAt: string
// }
//
// export interface FaceAuthResult {
//   sessionId: string
//   authRequestId: string
//   authenticated: boolean
//   eligibility: unknown
//   kioskStep: string
//   userMessageCode: string | null
//   retryable: boolean
// }
//
// // 연결 → 세션 생성(KSK-SESSION-001) → 얼굴 인증 요청(KSK-AUTH-001) 왕복 한 번만 처리한다.
// // KIOSK.CONNECT/KIOSK.CONNECTED 핸드셰이크 스펙은 아직 확인 안 됨 — WebSocket 자체 open 이벤트로
// // "연결됨"을 대신한다(가정, 재확인 필요). 하트비트·재연결·연결 승계는 이번 범위에 포함하지 않는다.
// export function requestFaceAuthStart(): Promise<FaceAuthResult> {
//   return new Promise((resolve, reject) => {
//     const socket = new WebSocket(PI_WS_URL)
//
//     socket.onopen = () => {
//       const sessionRequestId = crypto.randomUUID()
//       const envelope = buildEnvelope({
//         messageType: 'KIOSK.SESSION.OPEN.REQUEST',
//         operationId: 'KSK-SESSION-001',
//         sessionId: null,
//         requestId: sessionRequestId,
//         payload: {
//           mode: 'RENT',
//           stationId: TEMP_STATION_ID,
//           clientSessionKey: getClientSessionKey(),
//           lastKnownSessionId: null,
//           operationRequestIds: {
//             faceAuthRequestId: null,
//             rentalRequestId: null,
//             returnRequestId: null,
//           },
//         },
//       })
//       socket.send(JSON.stringify(envelope))
//     }
//
//     socket.onmessage = (event) => {
//       let message: PiEnvelope
//       try {
//         message = JSON.parse(event.data)
//       } catch {
//         console.error('Pi 메시지 파싱 실패', event.data)
//         return
//       }
//
//       console.log('[Pi WS] received', message)
//
//       if (message.messageType === 'KIOSK.SESSION.OPEN.RESULT') {
//         const { sessionId } = message.payload as SessionOpenResult
//         const authRequestId = crypto.randomUUID()
//
//         const authEnvelope = buildEnvelope({
//           messageType: 'KIOSK.FACE_AUTH.REQUEST',
//           operationId: 'KSK-AUTH-001',
//           sessionId,
//           requestId: authRequestId,
//           payload: { authRequestId },
//         })
//         socket.send(JSON.stringify(authEnvelope))
//         return
//       }
//
//       if (message.messageType === 'KIOSK.FACE_AUTH.RESULT') {
//         socket.close()
//         resolve(message.payload as FaceAuthResult)
//         return
//       }
//
//       if (message.messageType === 'KIOSK.OPERATION.ERROR') {
//         socket.close()
//         reject(message.payload)
//       }
//     }
//
//     socket.onerror = (event) => {
//       reject(event)
//     }
//   })
// }

const PI_WS_URL = import.meta.env.VITE_PI_WS_URL

// TEMP: 가장 기본적인 연결 확인용 — Envelope 없이 단순 메시지 하나만 주고받는다.
export function requestFaceAuthStart(): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(PI_WS_URL)

    socket.onopen = () => {
      console.log('[Pi WS] open')
      socket.send(JSON.stringify({ type: 'START_FACE_AUTH' }))
    }

    socket.onmessage = (event) => {
      console.log('[Pi WS] message', event.data)
      resolve()
    }

    socket.onerror = (event) => {
      console.error('[Pi WS] error', event)
      reject(event)
    }

    socket.onclose = (event) => {
      console.log('[Pi WS] close', event.code, event.reason)
    }
  })
}
