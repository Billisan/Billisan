import { useEffect } from 'react'
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

// AUTH_TIMEOUT(PROJECT_GUIDE.md §17) 대응 — 캠 화면 진입 후 인증이 오래 걸리면 입력을 폐기하고 홈으로 돌아간다.
// 정확한 시간은 DEC-SF-010(09-screen-flow.md §6)이 아직 DECISION_REQUIRED라 임시값. 실서버가 GUIDANCE를
// 계속 보내는 동안(안내가 살아있는 동안)은 타임아웃을 미루도록 guidanceMessage도 의존성에 둔다.
const AUTH_TIMEOUT_MS = 30_000

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
  const guidanceMessage = useFaceAuthStore((state) => state.guidanceMessage)
  const displayName = useFaceAuthStore((state) => state.displayName)
  const startCapture = useFaceAuthStore((state) => state.startCapture)
  const retry = useFaceAuthStore((state) => state.retry)
  const confirmIdentity = useFaceAuthStore((state) => state.confirmIdentity)

  // 카메라 화면(FACE_CAPTURE)에서 서버 응답(GUIDANCE 포함)이 오래 끊기면 홈으로 돌아간다.
  // GUIDANCE가 올 때마다 타이머를 리셋해 — 실제로 안내가 계속되는 중인데 끊어버리지 않도록 한다.
  useEffect(() => {
    if (variant !== AUTH_SCREEN_VARIANT.FACE_CAPTURE) return

    const timer = setTimeout(onBack, AUTH_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [variant, guidanceMessage, onBack])

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
      return (
        <CameraCaptureScreen
          streamUrl={`${CAMERA_STREAM_BASE_URL}?token=${encodeURIComponent(FACE_STREAM_TOKEN)}`}
          guide={<FaceGuideOverlay message={guidanceMessage} />}
          onBack={onBack}
          currentStep={2}
          flow={mode}
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
