import { Button } from '../../components/common/Button'
import { StatusMessage } from '../../components/common/StatusMessage'
import { KioskLayout } from '../../components/layout/KioskLayout'

interface SlotGuideScreenProps {
  slotNumber: number
  message: string
  actionLabel?: string
  onAction?: () => void
  onBack?: () => void
}

export function SlotGuideScreen({
  slotNumber,
  message,
  actionLabel = '확인',
  onAction,
  onBack,
}: SlotGuideScreenProps) {
  return (
    <KioskLayout onBack={onBack}>
      <div className="bg-primary/20 flex h-32 w-32 items-center justify-center rounded-full text-5xl font-bold text-black">
        {slotNumber}
      </div>
      <StatusMessage>{message}</StatusMessage>
      {onAction && (
        <Button onClick={onAction} className="w-48">
          {actionLabel}
        </Button>
      )}
    </KioskLayout>
  )
}
