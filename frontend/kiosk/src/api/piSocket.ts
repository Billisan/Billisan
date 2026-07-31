const PI_WS_RENT_URL = import.meta.env.VITE_PI_WS_RENT_URL
const PI_WS_RETURN_URL = import.meta.env.VITE_PI_WS_RETURN_URL

export interface PiStageMessage {
  stage: string
  message?: string
  status?: string
  resultCode?: string
  eligible?: boolean
  reasonCode?: string
}

interface FaceAuthStreamCallbacks {
  onStarted: () => void
  onGuidance: (message: string) => void
  onSucceeded: () => void
  onFailed: (message?: string) => void
  // SLOT_REQUESTED~DONE 등 아직 페이로드를 확인 못 한 이후 단계 — 로그만 남기고 화면엔 반영하지 않는다.
  onUnhandledStage: (raw: PiStageMessage) => void
}

// 실서버 실측 프로토콜(2026-07-30, 팀 채팅 확인) — Envelope 없는 flat {stage, ...} JSON 스트림.
// AUTH_STARTED → (GUIDANCE ×N) → AUTH_SUCCEEDED|AUTH_FAILED → (SLOT_REQUESTED~DONE, 이번 범위 밖)
// 모르는 stage는 에러 처리하지 않고 무시한다(팀 확인 원칙) — onUnhandledStage로만 흘려보냄.
// mode(RENT/RETURN)를 트리거 메시지에 같이 실어 보낸다 — 서버가 대여/반납 흐름을 구분할 수 있도록.
// 서버가 이 필드를 실제로 사용하는지는 미확인(추가된 필드, 기존 type은 그대로 유지).
export function startFaceAuthStream(
  mode: 'RENT' | 'RETURN',
  callbacks: FaceAuthStreamCallbacks,
): () => void {
  const socket = new WebSocket(mode === 'RETURN' ? PI_WS_RETURN_URL : PI_WS_RENT_URL)

  socket.onopen = () => {
    console.log('[Pi WS] open', mode)
    socket.send(JSON.stringify({ type: 'START_FACE_AUTH', mode }))
  }

  socket.onmessage = (event) => {
    let data: PiStageMessage
    try {
      data = JSON.parse(event.data)
    } catch {
      console.error('Pi 메시지 파싱 실패', event.data)
      return
    }

    switch (data.stage) {
      case 'AUTH_STARTED':
        callbacks.onStarted()
        break

      case 'GUIDANCE':
        if (data.message) callbacks.onGuidance(data.message)
        break

      case 'AUTH_SUCCEEDED':
        callbacks.onSucceeded()
        break

      case 'AUTH_FAILED':
        callbacks.onFailed(data.message)
        break

      default:
        callbacks.onUnhandledStage(data)
    }
  }

  socket.onerror = (event) => {
    console.error('[Pi WS] error', event)
  }

  socket.onclose = (event) => {
    console.log('[Pi WS] close', event.code, event.reason)
  }

  return () => socket.close()
}

interface ReturnInspectionStreamCallbacks {
  // 반납·우산 파손 인식 stage 이름을 아직 팀 확인 전이라, 전부 이 콜백 하나로 흘려보낸다.
  onStage: (raw: PiStageMessage) => void
}

// TEMP/추정 구현 — 반납·우산 파손 인식 트리거 메시지 이름(`START_RETURN_INSPECTION`)은
// 팀 확인 전 추측값이다(얼굴 인증의 START_FACE_AUTH와 같은 패턴을 가정). 실서버 반응으로
// 검증되면 이 주석과 함께 확정 구현으로 교체한다.
export function startReturnInspectionStream(
  callbacks: ReturnInspectionStreamCallbacks,
): () => void {
  const socket = new WebSocket(PI_WS_RETURN_URL)

  socket.onopen = () => {
    console.log('[Pi WS] open (return inspection, TEMP 추정)')
    socket.send(JSON.stringify({ type: 'START_RETURN_INSPECTION' }))
  }

  socket.onmessage = (event) => {
    let data: PiStageMessage
    try {
      data = JSON.parse(event.data)
    } catch {
      console.error('Pi 메시지 파싱 실패', event.data)
      return
    }

    console.log('[Pi WS] return inspection stage', data)
    callbacks.onStage(data)
  }

  socket.onerror = (event) => {
    console.error('[Pi WS] error', event)
  }

  socket.onclose = (event) => {
    console.log('[Pi WS] close', event.code, event.reason)
  }

  return () => socket.close()
}
