import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Logo from '../../assets/logo-navy.svg'

interface AppHeaderProps {
  schoolName: string
  alertCount: number
  onPressAlert?: () => void
}

// 홈·마이페이지가 공유하는 상단 헤더(로고+학교명+알림 벨). ScrollView 안이 아니라 Screen 바로
// 아래(스크롤과 무관하게 항상 고정)에 둬서 쓰는 걸 전제로 한다 — Screen이 이 화면들에선 top 세이프
// 에어리어를 비워두고(edges에서 제외), 대신 이 컴포넌트가 insets.top만큼 paddingTop을 직접 줘서
// 상태바 영역까지 흰 배경이 이어지게 한다(edge-to-edge, 상단 포함).
// onPressAlert 없으면 배지만 표시하고 탭해도 무동작(마이페이지는 아직 이 Phase 범위 밖이라 미연결).
export function AppHeader({ schoolName, alertCount, onPressAlert }: AppHeaderProps) {
  const insets = useSafeAreaInsets()

  return (
    <View
      className="flex-row items-center bg-white px-6 pb-4"
      style={{ paddingTop: insets.top + 16 }}
    >
      <View className="flex-1 items-start">
        <Logo width={56} height={32} />
      </View>
      <Text className="text-center text-lg font-semibold">{schoolName}</Text>
      <View className="flex-1 items-end">
        <Pressable onPress={onPressAlert} disabled={!onPressAlert} className="relative active:opacity-70">
          <MaterialCommunityIcons name="bell-outline" size={24} color="#1E2A38" />
          {alertCount > 0 && (
            <View className="absolute -right-2 -top-2 h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1">
              <Text className="text-xs font-bold text-text">{alertCount > 9 ? '9+' : alertCount}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  )
}
