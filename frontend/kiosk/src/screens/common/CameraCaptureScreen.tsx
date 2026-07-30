import type { ReactNode } from 'react'
import { KioskLayout } from '../../components/layout/KioskLayout'

interface CameraCaptureScreenProps {
  streamUrl: string
  guide: ReactNode
  onBack?: () => void
  currentStep?: 1 | 2 | 3
}

export function CameraCaptureScreen({
  streamUrl,
  guide,
  onBack,
  currentStep,
}: CameraCaptureScreenProps) {
  return (
    <KioskLayout onBack={onBack} currentStep={currentStep} fullBleed>
      <div className="relative h-full w-full bg-black">
        <img
          src={streamUrl}
          alt="카메라 스트림"
          className="h-full w-full object-cover"
        />
        {guide}
      </div>
    </KioskLayout>
  )
}
