import { Spinner } from '../../components/common/Spinner'
import { StatusMessage } from '../../components/common/StatusMessage'
import { KioskLayout } from '../../components/layout/KioskLayout'

interface LoadingScreenProps {
  message: string
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <KioskLayout>
      <Spinner />
      <StatusMessage>{message}</StatusMessage>
    </KioskLayout>
  )
}
