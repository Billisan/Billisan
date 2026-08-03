import { openSession, startFaceAuth } from './piSocket'
import { RENTAL_BLOCK_REASON, type RentalBlockReason } from '../types/eligibility'
import {
  KIOSK_STAGE,
  type EligibilityReasonCode,
  type KioskMode,
  type KioskStageMessage,
} from '../types/kioskStage'

type StageListener = (message: KioskStageMessage) => void

const KNOWN_BLOCK_REASONS = new Set<string>(Object.values(RENTAL_BLOCK_REASON))

// 세션 열기(KSK-SESSION-001) → 얼굴 인증(KSK-AUTH-001) 순서로 처리한다(문서 §5 필수 순서).
// 반환 함수는 화면 이탈·재시도 시 이후 단계 진행을 막는다(WebSocket 자체는 지속 연결이라 안 끊음).
export function startKioskStageStream(
  mode: KioskMode,
  onStage: StageListener,
): () => void {
  let cancelled = false

  void (async () => {
    try {
      const session = await openSession(mode)
      if (cancelled) return

      onStage({ stage: KIOSK_STAGE.AUTH_STARTED, sessionId: session.sessionId })

      const result = await startFaceAuth(session.sessionId, (event) => {
        if (cancelled) return
        if (event.status === 'GUIDANCE') {
          onStage({
            stage: KIOSK_STAGE.GUIDANCE,
            guidanceCode: event.guidanceCode ?? undefined,
          })
        }
      })
      if (cancelled) return

      if (!result.authenticated) {
        onStage({
          stage: KIOSK_STAGE.AUTH_FAILED,
          message: result.userMessageCode ?? undefined,
        })
        return
      }

      onStage({ stage: KIOSK_STAGE.AUTH_SUCCEEDED, displayName: result.displayName })

      // blockingReasons에 실제로 어떤 문자열이 오는지 문서에 명시되지 않음 — 사용자 확인(2026-07-31)에
      // 따라 기존 RentalBlockReason 값이 들어있다고 가정하고, 모르는 값은 무시(문서 §3 전방 호환 원칙).
      const knownReason = result.eligibility.blockingReasons.find((reason) =>
        KNOWN_BLOCK_REASONS.has(reason),
      ) as RentalBlockReason | undefined

      onStage({
        stage: KIOSK_STAGE.ELIGIBILITY_RESULT,
        eligible: result.eligibility.eligible,
        reasonCode: result.eligibility.eligible
          ? ('ELIGIBLE' as EligibilityReasonCode)
          : knownReason,
        sessionId: session.sessionId,
      })
    } catch (error) {
      if (cancelled) return
      console.error('[Pi WS] 인증 스트림 실패', error)
      onStage({ stage: KIOSK_STAGE.AUTH_FAILED })
    }
  })()

  return () => {
    cancelled = true
  }
}

export function isRentalBlockReason(
  reasonCode: EligibilityReasonCode | undefined,
): reasonCode is RentalBlockReason {
  return reasonCode !== undefined && reasonCode !== 'ELIGIBLE'
}
