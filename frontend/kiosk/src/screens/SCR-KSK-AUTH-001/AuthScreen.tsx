import { useEffect } from 'react'
import { FaceGuideOverlay } from '../../components/common/FaceGuideOverlay'
import type { StepFlow } from '../../components/layout/StepIndicator'
import { useFaceAuthStore } from '../../store/faceAuthStore'
import { AUTH_SCREEN_VARIANT, FACE_AUTH_RESULT } from '../../types/faceAuth'
import { CameraCaptureScreen } from '../common/CameraCaptureScreen'
import { ErrorScreen } from '../common/ErrorScreen'
import { LoadingScreen } from '../common/LoadingScreen'
import { FaceAuthGuideScreen } from './FaceAuthGuideScreen'

const FACE_STREAM_TOKEN = import.meta.env.VITE_FACE_STREAM_TOKEN

// 09번 문서 §3.2 액션 표에 명시적 시작 액션은 있으나 정확한 트리거 방식(자동 vs 버튼)은
// 문서 근거가 약함 — 이번 PLAN은 화면 진입 후 일정 시간 뒤 자동 시작으로 근사한다.
const AUTO_CAPTURE_DELAY_MS = 1500

// AUTH_TIMEOUT(PROJECT_GUIDE.md §17) 대응 — 캠 화면 진입 후 인증이 오래 걸리면 입력을 폐기하고 홈으로 돌아간다.
// 정확한 시간은 DEC-SF-010(09-screen-flow.md §6)이 아직 DECISION_REQUIRED라 10초는 임시값 — PoC 후 재확인 필요.
const AUTH_TIMEOUT_MS = 10_000

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
  const startCapture = useFaceAuthStore((state) => state.startCapture)
  const authenticateFace = useFaceAuthStore((state) => state.authenticateFace)
  const retry = useFaceAuthStore((state) => state.retry)

  useEffect(() => {
    if (variant !== AUTH_SCREEN_VARIANT.FACE_CAPTURE) return

    const timer = setTimeout(() => {
      authenticateFace().then((result) => {
        if (result === FACE_AUTH_RESULT.MATCHED) onAuthenticated()
      })
    }, AUTO_CAPTURE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [variant, authenticateFace, onAuthenticated])

  // 카메라 화면(FACE_CAPTURE)에서 10초 안에 다음 단계(FACE_PROCESSING 등)로 넘어가지 못하면 홈으로 돌아간다.
  useEffect(() => {
    if (variant !== AUTH_SCREEN_VARIANT.FACE_CAPTURE) return

    const timer = setTimeout(onBack, AUTH_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [variant, onBack])

  switch (variant) {
    case AUTH_SCREEN_VARIANT.GUIDE:
      return (
        <FaceAuthGuideScreen onAction={startCapture} onBack={onBack} flow={mode} />
      )

    case AUTH_SCREEN_VARIANT.FACE_CAPTURE:
      return (
        <CameraCaptureScreen
          streamUrl={`http://127.0.0.1:8080/video?token=${encodeURIComponent(FACE_STREAM_TOKEN)}`}
          guide={<FaceGuideOverlay />}
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
          onAction={retry}
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
