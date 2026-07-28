import { AlertCircleIcon } from '../icons/AlertCircleIcon'
import { KioskLayout } from '../layout/KioskLayout'
import { Button } from './Button'

interface ErrorScreenProps {
  message: string
  actionLabel?: string
  onAction: () => void
}

export function ErrorScreen({
  message,
  actionLabel = '홈으로',
  onAction,
}: ErrorScreenProps) {
  return (
    <KioskLayout>
      <div className="bg-error-bg text-error-text flex h-20 w-20 items-center justify-center rounded-full">
        <AlertCircleIcon className="h-12 w-12" />
      </div>
      <p className="text-2xl font-medium text-black">{message}</p>
      <Button onClick={onAction} className="w-48">
        {actionLabel}
      </Button>
    </KioskLayout>
  )
}
