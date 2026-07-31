import { useEffect } from 'react'
import { FaceGuideOverlay } from '../../components/common/FaceGuideOverlay'
import type { StepFlow } from '../../components/layout/StepIndicator'
import { useFaceAuthStore } from '../../store/faceAuthStore'
import { AUTH_SCREEN_VARIANT } from '../../types/faceAuth'
import { CameraCaptureScreen } from '../common/CameraCaptureScreen'
import { ErrorScreen } from '../common/ErrorScreen'
import { LoadingScreen } from '../common/LoadingScreen'
import { FaceAuthGuideScreen } from './FaceAuthGuideScreen'

const FACE_STREAM_TOKEN = import.meta.env.VITE_FACE_STREAM_TOKEN

// AUTH_TIMEOUT(PROJECT_GUIDE.md §17) 대응 — 캠 화면 진입 후 인증이 오래 걸리면 입력을 폐기하고 홈으로 돌아간다.
// 정확한 시간은 DEC-SF-010(09-screen-flow.md §6)이 아직 DECISION_REQUIRED라 임시값. 실서버가 GUIDANCE를
// 계속 보내는 동안(안내가 살아있는 동안)은 타임아웃을 미루도록 guidanceMessage도 의존성에 둔다.
const AUTH_TIMEOUT_MS = 30_000

interface AuthScreenProps {
  onBack: () => void
  onAuthenticated: () => void
  mode?: StepFlow
}

export function AuthScreen({
  onBack,
  onAuthenticated,
  mode = 'RENT',
}: AuthScreenProps) {
  const variant = useFaceAuthStore((state) => state.variant)
  const guidanceMessage = useFaceAuthStore((state) => state.guidanceMessage)
  const startCapture = useFaceAuthStore((state) => state.startCapture)
  const retry = useFaceAuthStore((state) => state.retry)

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
          onAction={() => startCapture(mode, onAuthenticated)}
          onBack={onBack}
          flow={mode}
        />
      )

    case AUTH_SCREEN_VARIANT.FACE_CAPTURE:
      return (
        <CameraCaptureScreen
          streamUrl={`http://127.0.0.1:8080/video?token=${encodeURIComponent(FACE_STREAM_TOKEN)}`}
          guide={<FaceGuideOverlay message={guidanceMessage} />}
          onBack={onBack}
          currentStep={2}
          flow={mode}
        />
      )

    case AUTH_SCREEN_VARIANT.FACE_PROCESSING:
      return (
        <LoadingScreen
          title="환영합니다!"
          subtitle="잠시만 기다려주세요"
          currentStep={2}
          flow={mode}
        />
      )

    case AUTH_SCREEN_VARIANT.FACE_NOT_DETECTED:
      return (
        <ErrorScreen
          title="안면 인식이 되지 않았습니다"
          tips={[
            '화면 가이드 라인에 얼굴을 맞춰주세요.',
            '얼굴을 정면으로 바라봐 주세요.',
            '마스크를 잠시 벗어주세요.',
          ]}
          actionLabel="안면 인식 다시하기"
          onAction={() => retry(mode, onAuthenticated)}
          secondaryActionLabel="홈으로 돌아가기"
          onSecondaryAction={onBack}
          currentStep={2}
          flow={mode}
        />
      )

    case AUTH_SCREEN_VARIANT.FACE_NOT_MATCHED:
      return (
        <ErrorScreen
          title="일치하는 학생 정보를 찾을 수 없습니다"
          tips={[
            '얼굴은 확인되었지만 연결된 학생 계정이 없습니다.',
            '학생 인증을 완료한 계정인지 확인해주세요.',
            '문제가 계속되면 관리자에게 문의해주세요.',
          ]}
          actionLabel="홈으로 돌아가기"
          onAction={onBack}
          currentStep={2}
          flow={mode}
        />
      )
  }
}
