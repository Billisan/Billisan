import {
  RENTAL_BLOCK_REASON,
  type RentalBlockReason,
} from '../types/eligibility'
import {
  KIOSK_STAGE,
  type EligibilityReasonCode,
  type KioskMode,
  type KioskStageMessage,
} from '../types/kioskStage'
import {
  startFaceAuthStream,
  startReturnInspectionStream,
  type PiStageMessage,
} from './piSocket'

type StageListener = (message: KioskStageMessage) => void
type ReturnInspectionListener = (raw: PiStageMessage) => void

const STAGE_SOURCE = import.meta.env.VITE_KIOSK_STAGE_SOURCE ?? 'websocket'

const MOCK_ELIGIBILITY_VALUES = new Set<EligibilityReasonCode>([
  'ELIGIBLE',
  RENTAL_BLOCK_REASON.UNSETTLED_BLOCKED,
  RENTAL_BLOCK_REASON.ACTIVE_RENTAL_EXISTS,
  RENTAL_BLOCK_REASON.ACTIVE_RENTAL_NOT_FOUND,
])

function getMockEligibility(mode: KioskMode): EligibilityReasonCode {
  const configured = import.meta.env.VITE_MOCK_ELIGIBILITY

  if (configured && MOCK_ELIGIBILITY_VALUES.has(configured as EligibilityReasonCode)) {
    return configured as EligibilityReasonCode
  }

  // 반납에서만 의미가 있는 기본 차단값을 대여에 실수로 적용하지 않도록 한다.
  if (mode === 'RETURN') return 'ELIGIBLE'

  return 'ELIGIBLE'
}

// 실제 Pi WebSocket 계약이 확정되기 전 UI를 검증하는 stage producer.
// 반환 함수는 실제 WebSocket close와 동일하게 화면 이탈·재시도 때 예약된 이벤트를 취소한다.
export function startMockKioskStageStream(
  mode: KioskMode,
  onStage: StageListener,
): () => void {
  const eligibility = getMockEligibility(mode)
  const timers = [
    window.setTimeout(
      () => onStage({ stage: KIOSK_STAGE.AUTH_STARTED }),
      100,
    ),
    window.setTimeout(
      () =>
        onStage({
          stage: KIOSK_STAGE.GUIDANCE,
          message: '카메라를 바라봐 주세요',
        }),
      500,
    ),
    window.setTimeout(
      () => onStage({ stage: KIOSK_STAGE.AUTH_SUCCEEDED }),
      1_100,
    ),
    window.setTimeout(
      () =>
        onStage({
          stage: KIOSK_STAGE.ELIGIBILITY_RESULT,
          eligible: eligibility === 'ELIGIBLE',
          reasonCode: eligibility,
        }),
      1_500,
    ),
  ]

  return () => timers.forEach((timer) => window.clearTimeout(timer))
}

// 현재 Pi가 ELIGIBILITY_RESULT를 아직 보내지 않으므로, 기존 AUTH_SUCCEEDED 성공 흐름을
// 보존하기 위해 그 직후 임시 ELIGIBLE stage를 만든다. Pi 계약이 확정되면 이 호환 처리만 제거하고
// Pi가 보낸 ELIGIBILITY_RESULT를 그대로 전달한다.
function startPiKioskStageStream(
  mode: KioskMode,
  onStage: StageListener,
): () => void {
  return startFaceAuthStream(mode, {
    onStarted: () => onStage({ stage: KIOSK_STAGE.AUTH_STARTED }),
    onGuidance: (message) =>
      onStage({ stage: KIOSK_STAGE.GUIDANCE, message }),
    onSucceeded: () => {
      onStage({ stage: KIOSK_STAGE.AUTH_SUCCEEDED })
      onStage({
        stage: KIOSK_STAGE.ELIGIBILITY_RESULT,
        eligible: true,
        reasonCode: 'ELIGIBLE',
      })
    },
    onFailed: (message) =>
      onStage({ stage: KIOSK_STAGE.AUTH_FAILED, message }),
    onUnhandledStage: (raw) => {
      if (raw.stage === KIOSK_STAGE.ELIGIBILITY_RESULT) {
        onStage({
          stage: KIOSK_STAGE.ELIGIBILITY_RESULT,
          eligible: raw.eligible,
          reasonCode: raw.reasonCode as EligibilityReasonCode | undefined,
        })
        return
      }

      // Pi가 앞으로 stage를 확장해도 현재 인증 화면을 오류로 전환하지 않는다.
      console.log('[Pi WS] 아직 화면에 연결하지 않은 stage', raw)
    },
  })
}

// 기본값은 기존 Pi WebSocket 경로다. Mock은 명시적으로 환경 변수를 설정했을 때만 사용한다.
export function startKioskStageStream(
  mode: KioskMode,
  onStage: StageListener,
): () => void {
  return STAGE_SOURCE === 'mock'
    ? startMockKioskStageStream(mode, onStage)
    : startPiKioskStageStream(mode, onStage)
}

// 반납·우산 파손 인식 stage 이름은 아직 팀 미확인이라(piSocket.ts TEMP 주석 참고)
// 실제 Pi가 보내는 완료 신호를 추측하지 않는다. 이 값은 Mock 모드에서만 쓰는 테스트 전용
// sentinel이며, 실제 프로토콜의 일부가 아니다 — Pi 계약이 확정되면 이 상수와 Mock 함수를 제거한다.
export const MOCK_CAPTURE_SUCCEEDED_STAGE = 'MOCK_CAPTURE_SUCCEEDED'

// 얼굴 인증 Mock과 동일한 목적 — 반납 우산 인식 화면 UI를 Pi 연결 없이 검증하기 위한 producer.
export function startMockReturnInspectionStream(
  onStage: ReturnInspectionListener,
): () => void {
  const timers = [
    window.setTimeout(
      () =>
        onStage({
          stage: 'GUIDANCE',
          message: '우산을 화면 중앙에 맞춰주세요',
        }),
      500,
    ),
    window.setTimeout(
      () =>
        onStage({
          stage: 'GUIDANCE',
          message: '움직이지 말고 잠시 기다려주세요',
        }),
      1_500,
    ),
    window.setTimeout(
      () =>
        onStage({
          stage: MOCK_CAPTURE_SUCCEEDED_STAGE,
          message: '인식 완료',
        }),
      2_500,
    ),
  ]

  return () => timers.forEach((timer) => window.clearTimeout(timer))
}

// 기본값은 기존 Pi WebSocket 경로다. Mock은 명시적으로 환경 변수를 설정했을 때만 사용한다.
export function startReturnInspectionStageStream(
  onStage: ReturnInspectionListener,
): () => void {
  return STAGE_SOURCE === 'mock'
    ? startMockReturnInspectionStream(onStage)
    : startReturnInspectionStream({ onStage })
}

export function isRentalBlockReason(
  reasonCode: EligibilityReasonCode | undefined,
): reasonCode is RentalBlockReason {
  return reasonCode !== undefined && reasonCode !== 'ELIGIBLE'
}
