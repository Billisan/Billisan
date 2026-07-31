import { create } from 'zustand'
import { startFaceAuthStream } from '../api/piSocket'
import { AUTH_SCREEN_VARIANT, type AuthScreenVariant } from '../types/faceAuth'

type FaceAuthMode = 'RENT' | 'RETURN'

interface FaceAuthState {
  variant: AuthScreenVariant
  guidanceMessage: string | null
  startCapture: (mode: FaceAuthMode, onAuthenticated: () => void) => void
  retry: (mode: FaceAuthMode, onAuthenticated: () => void) => void
  reset: () => void
}

// 스토어 밖(모듈 스코프)에서 진행 중인 스트림의 종료 함수를 들고 있는다 — retry/reset 시 이전 연결을 정리하기 위함.
let closeStream: (() => void) | null = null

export const useFaceAuthStore = create<FaceAuthState>((set, get) => ({
  variant: AUTH_SCREEN_VARIANT.GUIDE,
  guidanceMessage: null,

  // DEC-032 — Pi에 얼굴 인증을 요청하고, 실시간 stage 스트림(AUTH_STARTED/GUIDANCE/AUTH_SUCCEEDED/AUTH_FAILED)에
  // 따라 화면을 전환한다. 프로토콜은 Envelope 방식이 아니라 flat {stage,...} 방식(2026-07-30 팀 확인).
  // mode(RENT/RETURN)를 트리거 메시지에 실어 보내 대여/반납 흐름을 서버가 구분할 수 있게 한다.
  startCapture: (mode, onAuthenticated) => {
    closeStream?.()
    set({ variant: AUTH_SCREEN_VARIANT.FACE_CAPTURE, guidanceMessage: null })

    closeStream = startFaceAuthStream(mode, {
      onGuidance: (message) => set({ guidanceMessage: message }),

      // MATCHED는 다음 화면으로 넘어가는 지점이라 이 스토어의 variant를 바꾸지 않는다 —
      // 호출부(AuthScreen → App.tsx)가 onAuthenticated로 결과를 받아 전환한다.
      onSucceeded: () => {
        set({ guidanceMessage: null })
        onAuthenticated()
      },

      // AUTH_FAILED가 "미검출"과 "미매칭" 중 무엇인지 구분하는 정보가 아직 없어
      // 일단 FACE_NOT_MATCHED로 매핑한다(임시 매핑, PLAN §5 참고).
      onFailed: () => set({ variant: AUTH_SCREEN_VARIANT.FACE_NOT_MATCHED, guidanceMessage: null }),

      onUnhandledStage: (raw) => console.log('[Pi WS] 아직 처리하지 않는 stage', raw),
    })
  },

  // 새 인증 시도이므로 startCapture와 동일하게 처음부터 다시 연결한다.
  retry: (mode, onAuthenticated) => get().startCapture(mode, onAuthenticated),

  reset: () => {
    closeStream?.()
    closeStream = null
    set({ variant: AUTH_SCREEN_VARIANT.GUIDE, guidanceMessage: null })
  },
}))
