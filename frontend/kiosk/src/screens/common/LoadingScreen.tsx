import { Spinner } from '../../components/common/Spinner'
import { StatusMessage } from '../../components/common/StatusMessage'
import { KioskLayout } from '../../components/layout/KioskLayout'

interface LoadingScreenProps {
  message: string
  currentStep?: 1 | 2 | 3
}

export function LoadingScreen({ message, currentStep }: LoadingScreenProps) {
  return (
    <KioskLayout currentStep={currentStep}>
      <Spinner />
      <StatusMessage>{message}</StatusMessage>
    </KioskLayout>
  )
}
