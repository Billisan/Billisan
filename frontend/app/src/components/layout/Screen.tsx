import type { ReactNode } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'

interface ScreenProps {
  children: ReactNode
}

export function Screen({ children }: ScreenProps) {
  return <SafeAreaView className="flex-1 bg-background">{children}</SafeAreaView>
}
