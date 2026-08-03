import { FaceGuideOverlay } from '../../components/common/FaceGuideOverlay'
import type { StepFlow } from '../../components/layout/StepIndicator'
import { useTranslation } from '../../i18n/useTranslation'
import { useFaceAuthStore } from '../../store/faceAuthStore'
import { AUTH_SCREEN_VARIANT } from '../../types/faceAuth'
import type { RentalBlockReason } from '../../types/eligibility'
import { CameraCaptureScreen } from '../common/CameraCaptureScreen'
import { ErrorScreen } from '../common/ErrorScreen'
import { LoadingScreen } from '../common/LoadingScreen'
import { AuthSuccessScreen } from './AuthSuccessScreen'
import { FaceAuthGuideScreen } from './FaceAuthGuideScreen'

const FACE_STREAM_TOKEN = import.meta.env.VITE_FACE_STREAM_TOKEN
const CAMERA_STREAM_BASE_URL = import.meta.env.VITE_CAMERA_STREAM_BASE_URL

interface AuthScreenProps {
  onBack: () => void
  onAuthenticated: (sessionId: string) => void
  onEligibilityBlocked: (reason: RentalBlockReason) => void
  mode?: StepFlow
}

export function AuthScreen({
  onBack,
  onAuthenticated,
  onEligibilityBlocked,
  mode = 'RENT',
}: AuthScreenProps) {
  const t = useTranslation()
  const variant = useFaceAuthStore((state) => state.variant)
  const guidanceCode = useFaceAuthStore((state) => state.guidanceCode)
  const displayName = useFaceAuthStore((state) => state.displayName)

  // 임베디드 문서(2026-07-31) §4.3 guidanceCode 문구 매핑 — 코드→문구 변환은 t(useTranslation)가
  // 있는 이 화면 레이어에서 담당한다(kioskStageStream.ts/faceAuthStore.ts는 원본 코드만 전달).
  const guidanceMessages: Record<string, string> = {
    NONE: t.auth.guidanceNone,
    CENTER_FACE: t.auth.guidanceCenterFace,
  }
  const guidanceMessage = guidanceCode
    ? (guidanceMessages[guidanceCode] ?? t.auth.guidanceDefault)
    : null
  const startCapture = useFaceAuthStore((state) => state.startCapture)
  const retry = useFaceAuthStore((state) => state.retry)
  const confirmIdentity = useFaceAuthStore((state) => state.confirmIdentity)
  const resetToGuide = useFaceAuthStore((state) => state.reset)

  switch (variant) {
    case AUTH_SCREEN_VARIANT.GUIDE:
      return (
        <FaceAuthGuideScreen
          onAction={() =>
            startCapture(mode, onAuthenticated, onEligibilityBlocked)
          }
          onBack={onBack}
          flow={mode}
        />
      )

    case AUTH_SCREEN_VARIANT.FACE_CAPTURE:
      // stepIndicator 기준 이전 단계(1단계, 안내 화면)로 돌아간다 — Main으로 나가지 않는다.
      // 카메라 Capture Lease는 아직 시작 전이라 취소가 안전하고(12-I KSK-AUTH-001 취소 경계),
      // 다시 "준비되었습니다"를 누르면 retry()와 동일하게 startCapture가 새로 시작된다.
      return (
        <CameraCaptureScreen
          streamUrl={`${CAMERA_STREAM_BASE_URL}?token=${encodeURIComponent(FACE_STREAM_TOKEN)}`}
          guide={<FaceGuideOverlay message={guidanceMessage} />}
          onBack={resetToGuide}
          currentStep={2}
          flow={mode}
          resetSignal={guidanceMessage}
        />
      )

    case AUTH_SCREEN_VARIANT.AUTH_SUCCESS:
      return (
        <AuthSuccessScreen
          flow={mode}
          displayName={displayName}
          onConfirm={confirmIdentity}
          onReject={() => retry(mode, onAuthenticated, onEligibilityBlocked)}
        />
      )

    case AUTH_SCREEN_VARIANT.FACE_PROCESSING:
      return (
        <LoadingScreen
          title={t.auth.welcome(displayName)}
          subtitle={t.common.pleaseWait}
          currentStep={2}
          flow={mode}
        />
      )

    case AUTH_SCREEN_VARIANT.FACE_NOT_DETECTED:
      return (
        <ErrorScreen
          title={t.auth.faceNotDetectedTitle}
          tips={t.auth.faceNotDetectedTips}
          actionLabel={t.auth.retryFaceAuth}
          onAction={() => retry(mode, onAuthenticated, onEligibilityBlocked)}
          secondaryActionLabel={t.common.homeReturn}
          onSecondaryAction={onBack}
          currentStep={2}
          flow={mode}
        />
      )

    case AUTH_SCREEN_VARIANT.FACE_NOT_MATCHED:
      return (
        <ErrorScreen
          title={t.auth.faceNotMatchedTitle}
          tips={t.auth.faceNotMatchedTips}
          actionLabel={t.common.homeReturn}
          onAction={onBack}
          currentStep={2}
          flow={mode}
        />
      )
  }
}
