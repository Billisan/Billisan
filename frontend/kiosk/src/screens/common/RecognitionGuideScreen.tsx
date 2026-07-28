import type { ReactNode } from 'react'
import { Button } from '../../components/common/Button'
import { IconBadge } from '../../components/common/IconBadge'
import { StatusMessage } from '../../components/common/StatusMessage'
import { KioskLayout } from '../../components/layout/KioskLayout'

interface RecognitionGuideScreenProps {
  icon: ReactNode
  message: string
  actionLabel?: string
  onAction?: () => void
  onBack?: () => void
}

export function RecognitionGuideScreen({
  icon,
  message,
  actionLabel = '시작하기',
  onAction,
  onBack,
}: RecognitionGuideScreenProps) {
  return (
    <KioskLayout onBack={onBack}>
      <IconBadge variant="neutral">{icon}</IconBadge>
      <StatusMessage>{message}</StatusMessage>
      {onAction && (
        <Button onClick={onAction} className="w-48">
          {actionLabel}
        </Button>
      )}
    </KioskLayout>
  )
}
