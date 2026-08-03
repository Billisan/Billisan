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
  guidanceCode: string | null
  displayName: string | null
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
  // AuthSuccessScreen의 "맞습니다" 클릭 시 호출 — FACE_PROCESSING으로 넘어가 자격 결과를 반영한다.
  confirmIdentity: () => void
  reset: () => void
}

// AUTH_SUCCEEDED와 ELIGIBILITY_RESULT는 같은 KSK-AUTH-001 RESULT에서 거의 동시에 오기 때문에,
// FACE_PROCESSING("환영합니다!") 화면이 뜨자마자 바로 다음 화면으로 넘어가 사실상 안 보이는 것을
// 막기 위해 최소 노출 시간을 둔다. AUTH_SUCCESS(체크 아이콘·실명 확인) 단계는 더 이상 타이머로
// 자동 전환하지 않고 confirmIdentity() 호출(사용자의 "맞습니다" 클릭)로만 넘어간다.
const FACE_PROCESSING_DISPLAY_MS = 1000

// 스토어 밖(모듈 스코프)에서 진행 중인 스트림·타이머·확인 콜백을 들고 있는다 — retry/reset 시 정리하기 위함.
let closeStream: (() => void) | null = null
let pendingTimers: number[] = []
let confirmIdentityRef: (() => void) | null = null

function clearPendingTimers() {
  pendingTimers.forEach((timer) => window.clearTimeout(timer))
  pendingTimers = []
}

export const useFaceAuthStore = create<FaceAuthState>((set, get) => ({
  variant: AUTH_SCREEN_VARIANT.GUIDE,
  guidanceCode: null,
  displayName: null,

  startCapture: (mode, onEligible, onBlocked) => {
    closeStream?.()
    clearPendingTimers()
    confirmIdentityRef = null
    set({ variant: AUTH_SCREEN_VARIANT.FACE_CAPTURE, guidanceCode: null, displayName: null })

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

      set({ variant: AUTH_SCREEN_VARIANT.FACE_NOT_MATCHED, guidanceCode: null })
    }

    confirmIdentityRef = () => {
      set({ variant: AUTH_SCREEN_VARIANT.FACE_PROCESSING })
      pendingTimers.push(
        window.setTimeout(resolveEligibility, FACE_PROCESSING_DISPLAY_MS),
      )
    }

    closeStream = startKioskStageStream(mode, (message) => {
      switch (message.stage) {
        case KIOSK_STAGE.AUTH_STARTED:
          set({ variant: AUTH_SCREEN_VARIANT.FACE_CAPTURE })
          return

        case KIOSK_STAGE.GUIDANCE:
          set({ guidanceCode: message.guidanceCode ?? null })
          return

        case KIOSK_STAGE.AUTH_SUCCEEDED:
          set({
            variant: AUTH_SCREEN_VARIANT.AUTH_SUCCESS,
            guidanceCode: null,
            displayName: message.displayName ?? null,
          })
          return

        case KIOSK_STAGE.ELIGIBILITY_RESULT:
          // confirmIdentity()가 호출된 뒤 resolveEligibility()가 이 값을 꺼내 쓴다.
          pendingEligibility = message
          return

        case KIOSK_STAGE.AUTH_FAILED:
          set({ variant: AUTH_SCREEN_VARIANT.FACE_NOT_MATCHED, guidanceCode: null })
      }
    })
  },

  // 새 인증 시도이므로 startCapture와 동일하게 처음부터 다시 연결한다.
  retry: (mode, onEligible, onBlocked) =>
    get().startCapture(mode, onEligible, onBlocked),

  confirmIdentity: () => {
    confirmIdentityRef?.()
  },

  reset: () => {
    closeStream?.()
    closeStream = null
    clearPendingTimers()
    confirmIdentityRef = null
    set({ variant: AUTH_SCREEN_VARIANT.GUIDE, guidanceCode: null, displayName: null })
  },
}))
