import { create } from 'zustand'
import {
  isRentalBlockReason,
  startKioskStageStream,
} from '../api/kioskStageStream'
import { KIOSK_STAGE, type KioskMode } from '../types/kioskStage'
import { AUTH_SCREEN_VARIANT, type AuthScreenVariant } from '../types/faceAuth'
import type { RentalBlockReason } from '../types/eligibility'

interface FaceAuthState {
  variant: AuthScreenVariant
  guidanceMessage: string | null
  startCapture: (
    mode: KioskMode,
    onEligible: () => void,
    onBlocked: (reason: RentalBlockReason) => void,
  ) => void
  retry: (
    mode: KioskMode,
    onEligible: () => void,
    onBlocked: (reason: RentalBlockReason) => void,
  ) => void
  reset: () => void
}

// 스토어 밖(모듈 스코프)에서 진행 중인 스트림의 종료 함수를 들고 있는다 — retry/reset 시 이전 연결을 정리하기 위함.
let closeStream: (() => void) | null = null

export const useFaceAuthStore = create<FaceAuthState>((set, get) => ({
  variant: AUTH_SCREEN_VARIANT.GUIDE,
  guidanceMessage: null,

  // 기본은 기존 Pi WebSocket producer이며, 환경 변수로 Mock producer를 선택할 수 있다.
  startCapture: (mode, onEligible, onBlocked) => {
    closeStream?.()
    set({ variant: AUTH_SCREEN_VARIANT.FACE_CAPTURE, guidanceMessage: null })

    closeStream = startKioskStageStream(mode, (message) => {
      switch (message.stage) {
        case KIOSK_STAGE.AUTH_STARTED:
          set({ variant: AUTH_SCREEN_VARIANT.FACE_CAPTURE })
          return

        case KIOSK_STAGE.GUIDANCE:
          set({ guidanceMessage: message.message ?? null })
          return

        case KIOSK_STAGE.AUTH_SUCCEEDED:
          set({
            variant: AUTH_SCREEN_VARIANT.FACE_PROCESSING,
            guidanceMessage: null,
          })
          return

        case KIOSK_STAGE.ELIGIBILITY_RESULT:
          if (message.eligible) {
            onEligible()
            return
          }

          if (isRentalBlockReason(message.reasonCode)) {
            onBlocked(message.reasonCode)
            return
          }
          set({ variant: AUTH_SCREEN_VARIANT.FACE_NOT_MATCHED, guidanceMessage: null })
          return

        case KIOSK_STAGE.AUTH_FAILED:
          set({ variant: AUTH_SCREEN_VARIANT.FACE_NOT_MATCHED, guidanceMessage: null })
      }
    })
  },

  // 새 인증 시도이므로 startCapture와 동일하게 처음부터 다시 연결한다.
  retry: (mode, onEligible, onBlocked) =>
    get().startCapture(mode, onEligible, onBlocked),

  reset: () => {
    closeStream?.()
    closeStream = null
    set({ variant: AUTH_SCREEN_VARIANT.GUIDE, guidanceMessage: null })
  },
}))
