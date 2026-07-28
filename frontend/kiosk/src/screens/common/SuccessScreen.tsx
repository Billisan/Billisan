import { Button } from '../../components/common/Button'
import { IconBadge } from '../../components/common/IconBadge'
import { StatusMessage } from '../../components/common/StatusMessage'
import { CheckCircleIcon } from '../../components/icons/CheckCircleIcon'
import { KioskLayout } from '../../components/layout/KioskLayout'

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
      <IconBadge variant="success">
        <CheckCircleIcon className="h-12 w-12" />
      </IconBadge>
      <StatusMessage>{message}</StatusMessage>
      <Button onClick={onAction} className="w-48">
        {actionLabel}
      </Button>
    </KioskLayout>
  )
}
