import { create } from 'zustand'
import {
  isRentalBlockReason,
  startKioskStageStream,
} from '../api/kioskStageStream'
import {
  KIOSK_STAGE,
  type KioskMode,
  type KioskStageMessage,
} from '../types/kioskStage'
import { AUTH_SCREEN_VARIANT, type AuthScreenVariant } from '../types/faceAuth'
import type { RentalBlockReason } from '../types/eligibility'

interface FaceAuthState {
  variant: AuthScreenVariant
  guidanceMessage: string | null
  startCapture: (
    mode: KioskMode,
    onEligible: (sessionId: string) => void,
    onBlocked: (reason: RentalBlockReason) => void,
  ) => void
  retry: (
    mode: KioskMode,
    onEligible: (sessionId: string) => void,
    onBlocked: (reason: RentalBlockReason) => void,
  ) => void
  reset: () => void
}

// AUTH_SUCCEEDED와 ELIGIBILITY_RESULT는 같은 KSK-AUTH-001 RESULT에서 거의 동시에 오기 때문에,
// 그대로 두면 "환영합니다!" 화면이 뜨자마자 바로 다음 화면으로 넘어가 사실상 안 보인다.
// 체크 아이콘(AUTH_SUCCESS) → 환영합니다(FACE_PROCESSING) 순서를 눈에 보이게 하려고
// ELIGIBILITY_RESULT 처리를 이 연출 시간만큼 미룬다.
const AUTH_SUCCESS_DISPLAY_MS = 1200
const FACE_PROCESSING_DISPLAY_MS = 1000

// 스토어 밖(모듈 스코프)에서 진행 중인 스트림·타이머를 들고 있는다 — retry/reset 시 정리하기 위함.
let closeStream: (() => void) | null = null
let pendingTimers: number[] = []

function clearPendingTimers() {
  pendingTimers.forEach((timer) => window.clearTimeout(timer))
  pendingTimers = []
}

export const useFaceAuthStore = create<FaceAuthState>((set, get) => ({
  variant: AUTH_SCREEN_VARIANT.GUIDE,
  guidanceMessage: null,

  startCapture: (mode, onEligible, onBlocked) => {
    closeStream?.()
    clearPendingTimers()
    set({ variant: AUTH_SCREEN_VARIANT.FACE_CAPTURE, guidanceMessage: null })

    let pendingEligibility: KioskStageMessage | null = null

    const resolveEligibility = () => {
      const message = pendingEligibility
      if (!message) return

      if (message.eligible && message.sessionId) {
        onEligible(message.sessionId)
        return
      }

      if (isRentalBlockReason(message.reasonCode)) {
        onBlocked(message.reasonCode)
        return
      }

      set({ variant: AUTH_SCREEN_VARIANT.FACE_NOT_MATCHED, guidanceMessage: null })
    }

    closeStream = startKioskStageStream(mode, (message) => {
      switch (message.stage) {
        case KIOSK_STAGE.AUTH_STARTED:
          set({ variant: AUTH_SCREEN_VARIANT.FACE_CAPTURE })
          return

        case KIOSK_STAGE.GUIDANCE:
          set({ guidanceMessage: message.message ?? null })
          return

        case KIOSK_STAGE.AUTH_SUCCEEDED:
          set({ variant: AUTH_SCREEN_VARIANT.AUTH_SUCCESS, guidanceMessage: null })
          pendingTimers.push(
            window.setTimeout(() => {
              set({ variant: AUTH_SCREEN_VARIANT.FACE_PROCESSING })
              pendingTimers.push(
                window.setTimeout(resolveEligibility, FACE_PROCESSING_DISPLAY_MS),
              )
            }, AUTH_SUCCESS_DISPLAY_MS),
          )
          return

        case KIOSK_STAGE.ELIGIBILITY_RESULT:
          // AUTH_SUCCEEDED 타이머가 끝난 뒤 resolveEligibility()가 이 값을 꺼내 쓴다.
          pendingEligibility = message
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
    clearPendingTimers()
    set({ variant: AUTH_SCREEN_VARIANT.GUIDE, guidanceMessage: null })
  },
}))
