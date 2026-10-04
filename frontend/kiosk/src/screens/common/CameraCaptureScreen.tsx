import { useEffect, useState, type ReactNode } from 'react'
import hourglassIcon from '../../assets/hourglass.svg'
import { KioskLayout } from '../../components/layout/KioskLayout'
import type { StepFlow } from '../../components/layout/StepIndicator'
import { useTranslation } from '../../i18n/useTranslation'

// PROJECT_GUIDE.md §17 AUTH_TIMEOUT 대응 — 캠 화면 진입 후 응답이 오래 끊기면 홈으로 돌아간다.
// 정확한 시간은 DEC-SF-010(09-screen-flow.md §6)이 아직 DECISION_REQUIRED라 임시값.
const DEFAULT_TIMEOUT_SECONDS = 15

interface CountdownBadgeProps {
  timeoutSeconds: number
  onTimeout?: () => void
}

// resetSignal이 바뀌면 CameraCaptureScreen이 이 컴포넌트를 다른 key로 리마운트해
// secondsLeft를 처음부터 다시 시작한다(예: 새 GUIDANCE 수신 — 안내가 계속되는 중인데
// 끊어버리지 않도록). effect 안에서 setState로 리셋하지 않고 리마운트로 처리해
// "setState synchronously within an effect" 린트 경고를 피한다.
function CountdownBadge({ timeoutSeconds, onTimeout }: CountdownBadgeProps) {
  const t = useTranslation()
  const [secondsLeft, setSecondsLeft] = useState(timeoutSeconds)

  useEffect(() => {
    if (secondsLeft <= 0) {
      onTimeout?.()
      return
    }

    const timer = window.setTimeout(() => setSecondsLeft((prev) => prev - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [secondsLeft, onTimeout])

  return (
    <div className="absolute top-6 left-1/2 z-10 flex -translate-x-1/2 items-center justify-center gap-3 rounded-full bg-white/90 px-6 py-2 shadow-md">
      <img src={hourglassIcon} alt="" className="h-8 w-8" />
      <span className="text-xl font-bold text-black">
        {t.common.secondsRemaining(secondsLeft)}
      </span>
    </div>
  )
}

interface CameraCaptureScreenProps {
  streamUrl: string
  guide: ReactNode
  onBack?: () => void
  currentStep?: 1 | 2 | 3 | 4
  flow?: StepFlow
  timeoutSeconds?: number
  // 값이 바뀔 때마다 카운트다운을 처음부터 다시 시작한다(예: 새 GUIDANCE 수신).
  resetSignal?: unknown
}

export function CameraCaptureScreen({
  streamUrl,
  guide,
  onBack,
  currentStep,
  flow,
  timeoutSeconds = DEFAULT_TIMEOUT_SECONDS,
  resetSignal,
}: CameraCaptureScreenProps) {
  return (
    <KioskLayout onBack={onBack} currentStep={currentStep} flow={flow} fullBleed>
      <div className="flex flex-1 flex-col w-full">
        <div className="relative flex-1 bg-black">
          {streamUrl && (
            <img
              src={streamUrl}
              alt="카메라 스트림"
              className="absolute inset-0 h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          )}
          <CountdownBadge
            key={`${timeoutSeconds}-${String(resetSignal)}`}
            timeoutSeconds={timeoutSeconds}
            onTimeout={onBack}
          />
          {guide}
        </div>
      </div>
    </KioskLayout>
  )
}
