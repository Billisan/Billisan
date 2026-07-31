import { Text, View } from 'react-native'
import { Button } from '../../components/common/Button'
import { Screen } from '../../components/layout/Screen'
import { useAuthStore } from '../../store/useAuthStore'

export function MyPageScreen() {
  const logout = useAuthStore((state) => state.logout)

  return (
    <Screen>
      <Text className="mt-10 text-center text-lg text-text">마이페이지 화면 — 준비 중</Text>
      {/* TEMP — 정식 마이페이지(와이어프레임 5번 페이지) 구현 시 이 버튼은 그 화면 안으로 옮긴다. */}
      <View className="mt-8 px-6">
        <Button label="로그아웃" onPress={() => logout()} />
      </View>
    </Screen>
  )
}
