import { ActivityIndicator, Text, View } from 'react-native'

interface LoadingScreenProps {
  message?: string
}

export function LoadingScreen({ message = '불러오는 중이에요' }: LoadingScreenProps) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background">
      <ActivityIndicator size="large" color="#FFD700" />
      <Text className="text-base text-text-secondary">{message}</Text>
    </View>
  )
}
