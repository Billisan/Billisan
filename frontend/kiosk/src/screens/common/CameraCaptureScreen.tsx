import type { ReactNode } from 'react'
import { KioskLayout } from '../../components/layout/KioskLayout'
import type { StepFlow } from '../../components/layout/StepIndicator'

interface CameraCaptureScreenProps {
  streamUrl: string
  guide: ReactNode
  onBack?: () => void
  currentStep?: 1 | 2 | 3 | 4
  flow?: StepFlow
}

export function CameraCaptureScreen({
  streamUrl,
  guide,
  onBack,
  currentStep,
  flow,
}: CameraCaptureScreenProps) {
  return (
    <KioskLayout onBack={onBack} currentStep={currentStep} flow={flow} fullBleed>
      <div className="relative h-full w-full bg-black">
        <img
          src={streamUrl}
          alt="카메라 스트림"
          className="h-full w-full object-contain"
        />
        {guide}
      </div>
    </KioskLayout>
  )
}
