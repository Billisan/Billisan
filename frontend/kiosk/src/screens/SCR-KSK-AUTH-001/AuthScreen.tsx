import { useEffect } from 'react'
import { FaceGuideOverlay } from '../../components/common/FaceGuideOverlay'
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

interface AuthScreenProps {
  onBack: () => void
  onAuthenticated: () => void
}

export function AuthScreen({ onBack, onAuthenticated }: AuthScreenProps) {
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

  switch (variant) {
    case AUTH_SCREEN_VARIANT.GUIDE:
      return <FaceAuthGuideScreen onAction={startCapture} onBack={onBack} />

    case AUTH_SCREEN_VARIANT.FACE_CAPTURE:
      return (
        <CameraCaptureScreen
          streamUrl={`http://127.0.0.1:8080/video?token=${encodeURIComponent(FACE_STREAM_TOKEN)}`}
          guide={<FaceGuideOverlay />}
          onBack={onBack}
          currentStep={2}
        />
      )

    case AUTH_SCREEN_VARIANT.FACE_PROCESSING:
      return (
        <LoadingScreen
          title="환영합니다!"
          subtitle="잠시만 기다려주세요"
          currentStep={2}
        />
      )

    case AUTH_SCREEN_VARIANT.FACE_NOT_DETECTED:
      return (
        <ErrorScreen
          message="얼굴을 인식하지 못했어요. 다시 촬영해주세요."
          actionLabel="다시 촬영"
          onAction={retry}
          currentStep={2}
        />
      )

    case AUTH_SCREEN_VARIANT.FACE_NOT_MATCHED:
      return (
        <ErrorScreen
          message="일치하는 얼굴 정보를 찾지 못했어요."
          actionLabel="홈으로"
          onAction={onBack}
          currentStep={2}
        />
      )
  }
}
