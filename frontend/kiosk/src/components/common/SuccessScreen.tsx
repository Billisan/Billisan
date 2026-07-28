import { CheckCircleIcon } from '../icons/CheckCircleIcon'
import { KioskLayout } from '../layout/KioskLayout'
import { Button } from './Button'

interface SuccessScreenProps {
  message: string
  actionLabel?: string
  onAction: () => void
}

export function SuccessScreen({
  message,
  actionLabel = '확인',
  onAction,
}: SuccessScreenProps) {
  return (
    <KioskLayout>
      <div className="bg-primary/20 flex h-20 w-20 items-center justify-center rounded-full text-black">
        <CheckCircleIcon className="h-12 w-12" />
      </div>
      <p className="text-2xl font-medium text-black">{message}</p>
      <Button onClick={onAction} className="w-48">
        {actionLabel}
      </Button>
    </KioskLayout>
  )
}
