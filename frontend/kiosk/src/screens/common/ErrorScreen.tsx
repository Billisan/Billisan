import { Button } from '../../components/common/Button'
import { IconBadge } from '../../components/common/IconBadge'
import { StatusMessage } from '../../components/common/StatusMessage'
import { AlertCircleIcon } from '../../components/icons/AlertCircleIcon'
import { KioskLayout } from '../../components/layout/KioskLayout'

interface ErrorScreenProps {
  message: string
  actionLabel?: string
  onAction: () => void
  currentStep?: 1 | 2 | 3
}

export function ErrorScreen({
  message,
  actionLabel = '홈으로',
  onAction,
  currentStep,
}: ErrorScreenProps) {
  return (
    <KioskLayout currentStep={currentStep}>
      <IconBadge variant="error">
        <AlertCircleIcon className="h-12 w-12" />
      </IconBadge>
      <StatusMessage>{message}</StatusMessage>
      <Button onClick={onAction} className="w-48">
        {actionLabel}
      </Button>
    </KioskLayout>
  )
}
