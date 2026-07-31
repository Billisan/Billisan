import { Text, View } from 'react-native'

interface ErrorBannerProps {
  message: string
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <View className="w-full rounded-xl bg-error-bg px-4 py-3">
      <Text className="text-sm font-medium text-error-text">{message}</Text>
    </View>
  )
}
