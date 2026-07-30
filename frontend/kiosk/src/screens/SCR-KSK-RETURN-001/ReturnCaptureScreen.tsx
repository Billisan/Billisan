import { useEffect } from 'react'
import { UmbrellaGuideOverlay } from '../../components/common/UmbrellaGuideOverlay'
import { CameraCaptureScreen } from '../common/CameraCaptureScreen'

const UMBRELLA_STREAM_TOKEN = import.meta.env.VITE_FACE_STREAM_TOKEN

// AuthScreen의 FACE_CAPTURE 자동 촬영 패턴과 동일 — 09번 문서에 정확한 트리거 방식(자동 vs 버튼) 근거가
// 약해 화면 진입 후 일정 시간 뒤 자동 촬영으로 근사한다.
const AUTO_CAPTURE_DELAY_MS = 1500

interface ReturnCaptureScreenProps {
  onCaptured: () => void
  onBack?: () => void
}

export function ReturnCaptureScreen({
  onCaptured,
  onBack,
}: ReturnCaptureScreenProps) {
  useEffect(() => {
    const timer = setTimeout(onCaptured, AUTO_CAPTURE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [onCaptured])

  return (
    <CameraCaptureScreen
      streamUrl={`http://127.0.0.1:8080/video?token=${encodeURIComponent(UMBRELLA_STREAM_TOKEN)}`}
      guide={<UmbrellaGuideOverlay />}
      onBack={onBack}
      currentStep={3}
      flow="RETURN"
    />
  )
}
