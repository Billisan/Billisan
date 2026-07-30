import { useEffect, useState } from 'react'
import { startReturnInspectionStream } from '../../api/piSocket'
import { UmbrellaGuideOverlay } from '../../components/common/UmbrellaGuideOverlay'
import { CameraCaptureScreen } from '../common/CameraCaptureScreen'

const UMBRELLA_STREAM_TOKEN = import.meta.env.VITE_FACE_STREAM_TOKEN

interface ReturnCaptureScreenProps {
  onCaptured: () => void
  onBack?: () => void
}

// TEMP/추정 — 반납·우산 파손 인식의 "성공" stage 이름을 아직 몰라서 자동으로 다음 화면으로
// 넘기지 않는다. 받은 stage는 전부 콘솔에 로그 + message가 있으면 화면에 표시하고,
// 다음 단계로는 수동 버튼으로 진행한다. 팀 확인되면 자동 진행으로 교체 예정.
export function ReturnCaptureScreen({
  onCaptured,
  onBack,
}: ReturnCaptureScreenProps) {
  const [guidanceMessage, setGuidanceMessage] = useState<string | null>(null)

  useEffect(() => {
    const close = startReturnInspectionStream({
      onStage: (data) => {
        if (data.message) setGuidanceMessage(data.message)
      },
    })
    return close
  }, [])

  return (
    <CameraCaptureScreen
      streamUrl={`http://127.0.0.1:8080/video?token=${encodeURIComponent(UMBRELLA_STREAM_TOKEN)}`}
      guide={
        <>
          <UmbrellaGuideOverlay message={guidanceMessage} />
          <button
            type="button"
            onClick={onCaptured}
            className="bg-primary absolute bottom-10 left-1/2 h-18 w-100 -translate-x-1/2 rounded-2xl text-2xl font-bold text-white transition-colors active:brightness-95"
          >
            다음으로
          </button>
        </>
      }
      onBack={onBack}
      currentStep={3}
      flow="RETURN"
    />
  )
}
