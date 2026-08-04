import { useMutation } from '@tanstack/react-query'
import { Text, View } from 'react-native'
import { logout } from '../../api/authApi'
import { Button } from '../../components/common/Button'
import { Screen } from '../../components/layout/Screen'
import { useAuthStore } from '../../store/useAuthStore'

export function MyPageScreen() {
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: clearAuth,
  })

  return (
    <Screen>
      <Text className="mt-10 text-center text-lg text-text">마이페이지 화면 — 준비 중</Text>
      {/* TEMP — 정식 마이페이지(와이어프레임 5번 페이지) 구현 시 이 버튼은 그 화면 안으로 옮긴다. */}
      <View className="mt-8 px-6">
        <Button
          label="로그아웃"
          onPress={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        />
      </View>
    </Screen>
  )
}
