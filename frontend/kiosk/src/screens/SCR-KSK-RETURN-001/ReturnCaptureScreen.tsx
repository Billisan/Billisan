import { useEffect, useState } from 'react'
import { startReturnInspectionStream } from '../../api/piSocket'
import { UmbrellaGuideOverlay } from '../../components/common/UmbrellaGuideOverlay'
import { CameraCaptureScreen } from '../common/CameraCaptureScreen'

const UMBRELLA_STREAM_TOKEN = import.meta.env.VITE_FACE_STREAM_TOKEN

interface ReturnCaptureScreenProps {
  onCaptured: () => void
  onBack?: () => void
}

// TEMP/추정 — 반납·우산 파손 인식의 "성공" stage 이름을 아직 몰라서 자동 진행 조건을 확정하지
// 못했다. onCaptured는 실제 "인식 성공" stage가 확인되면 그 지점에서 호출하도록 연결할 예정 —
// 지금은 어떤 stage가 그 신호인지 몰라 호출하지 않는다(추측 구현 금지). 받은 stage는 전부
// 콘솔에 로그 + message가 있으면 화면에 표시만 한다.
export function ReturnCaptureScreen({
  onBack,
}: ReturnCaptureScreenProps) {
  const [guidanceMessage, setGuidanceMessage] = useState<string | null>(null)

  useEffect(() => {
    const close = startReturnInspectionStream({
      onStage: (data) => {
        if (data.message) setGuidanceMessage(data.message)
        console.log('[Pi WS] return inspection stage(자동 진행 조건 미확정)', data)
      },
    })
    return close
  }, [])

  return (
    <CameraCaptureScreen
      streamUrl={`http://127.0.0.1:8080/video?token=${encodeURIComponent(UMBRELLA_STREAM_TOKEN)}`}
      guide={<UmbrellaGuideOverlay message={guidanceMessage} />}
      onBack={onBack}
      currentStep={3}
      flow="RETURN"
    />
  )
}
