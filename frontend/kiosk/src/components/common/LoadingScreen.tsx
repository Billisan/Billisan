import { KioskLayout } from '../layout/KioskLayout'

interface LoadingScreenProps {
  message: string
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <KioskLayout>
      <div
        className="border-primary/30 border-t-primary h-20 w-20 animate-spin rounded-full border-8"
        role="status"
        aria-label="로딩 중"
      />
      <p className="text-2xl font-medium text-black">{message}</p>
    </KioskLayout>
  )
}
