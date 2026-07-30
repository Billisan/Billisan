import { create } from 'zustand'
import { authenticateFace as authenticateFaceApi } from '../api/faceAuthApi'
import { requestFaceAuthStart } from '../api/piSocket'
import {
  AUTH_SCREEN_VARIANT,
  FACE_AUTH_RESULT,
  type AuthScreenVariant,
  type FaceAuthResult,
} from '../types/faceAuth'

interface FaceAuthState {
  variant: AuthScreenVariant
  startCapture: () => Promise<void>
  authenticateFace: () => Promise<FaceAuthResult>
  retry: () => void
  reset: () => void
}

export const useFaceAuthStore = create<FaceAuthState>((set) => ({
  variant: AUTH_SCREEN_VARIANT.GUIDE,

  // DEC-032 — Pi에 얼굴 인증 시작을 요청하고, Pi 응답을 받은 뒤에야 FACE_CAPTURE로 전환한다.
  // 실패 시 처리 방식은 아직 정해지지 않아 콘솔 로깅만 하고 GUIDE에 머무른다(6절 참고).
  startCapture: async () => {
    try {
      await requestFaceAuthStart()
      set({ variant: AUTH_SCREEN_VARIANT.FACE_CAPTURE })
    } catch (error) {
      console.error('Pi 얼굴 인증 시작 요청 실패', error)
    }
  },

  authenticateFace: async () => {
    set({ variant: AUTH_SCREEN_VARIANT.FACE_PROCESSING })
    const result = await authenticateFaceApi()

    if (result === FACE_AUTH_RESULT.NOT_DETECTED) {
      set({ variant: AUTH_SCREEN_VARIANT.FACE_NOT_DETECTED })
    } else if (result === FACE_AUTH_RESULT.NOT_MATCHED) {
      set({ variant: AUTH_SCREEN_VARIANT.FACE_NOT_MATCHED })
    }
    // MATCHED는 다음 화면(RENT-001, 다음 PLAN)으로 넘어가는 지점이라
    // 이 스토어의 variant를 바꾸지 않는다 — 호출부(AuthScreen)가 결과를 보고 전환한다.

    return result
  },

  retry: () => set({ variant: AUTH_SCREEN_VARIANT.FACE_CAPTURE }),

  reset: () => set({ variant: AUTH_SCREEN_VARIANT.GUIDE }),
}))
