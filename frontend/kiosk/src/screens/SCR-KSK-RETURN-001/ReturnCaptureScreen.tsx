import { useEffect, useState } from 'react'
import {
  MOCK_CAPTURE_SUCCEEDED_STAGE,
  startReturnInspectionStageStream,
} from '../../api/kioskStageStream'
import { UmbrellaGuideOverlay } from '../../components/common/UmbrellaGuideOverlay'
import { CameraCaptureScreen } from '../common/CameraCaptureScreen'

const UMBRELLA_STREAM_TOKEN = import.meta.env.VITE_FACE_STREAM_TOKEN
const CAMERA_STREAM_BASE_URL = import.meta.env.VITE_CAMERA_STREAM_BASE_URL

interface ReturnCaptureScreenProps {
  onCaptured: () => void
  onBack?: () => void
}

// TEMP/추정 — 반납·우산 파손 인식의 "성공" stage 이름을 아직 몰라서 실제 Pi 경로에서는
// onCaptured를 호출할 시점이 없다(추측 구현 금지). VITE_KIOSK_STAGE_SOURCE=mock일 때만
// Mock 전용 sentinel(MOCK_CAPTURE_SUCCEEDED_STAGE)로 onCaptured를 호출해 다음 화면 흐름을
// 테스트할 수 있다. 실제 Pi 경로는 받은 stage를 콘솔 로그 + message 화면 표시만 한다.
export function ReturnCaptureScreen({
  onBack,
  onCaptured,
}: ReturnCaptureScreenProps) {
  const [guidanceMessage, setGuidanceMessage] = useState<string | null>(null)

  useEffect(() => {
    const close = startReturnInspectionStageStream((data) => {
      if (data.message) setGuidanceMessage(data.message)
      console.log('[Pi WS] return inspection stage(자동 진행 조건 미확정)', data)

      if (data.stage === MOCK_CAPTURE_SUCCEEDED_STAGE) {
        onCaptured()
      }
    })
    return close
  }, [onCaptured])

  return (
    <CameraCaptureScreen
      streamUrl={`${CAMERA_STREAM_BASE_URL}?token=${encodeURIComponent(UMBRELLA_STREAM_TOKEN)}`}
      guide={<UmbrellaGuideOverlay message={guidanceMessage} />}
      onBack={onBack}
      currentStep={3}
      flow="RETURN"
    />
  )
}
