import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Logo from '../../assets/logo-navy.svg'

interface AppHeaderProps {
  schoolName: string
  alertCount: number
}

// 홈·마이페이지가 공유하는 상단 헤더(로고+학교명+알림 벨). ScrollView 안이 아니라 Screen 바로
// 아래(스크롤과 무관하게 항상 고정)에 둬서 쓰는 걸 전제로 한다 — Screen이 이 화면들에선 top 세이프
// 에어리어를 비워두고(edges에서 제외), 대신 이 컴포넌트가 insets.top만큼 paddingTop을 직접 줘서
// 상태바 영역까지 흰 배경이 이어지게 한다(edge-to-edge, 상단 포함).
// SCR-APP-NOTIFICATION-001은 아직 착수 전이라 벨 아이콘은 탭 이동 없이 배지 점만 보여준다.
export function AppHeader({ schoolName, alertCount }: AppHeaderProps) {
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
        <View className="relative">
          <MaterialCommunityIcons name="bell-outline" size={24} color="#1E2A38" />
          {alertCount > 0 && <View className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-primary" />}
        </View>
      </View>
    </View>
  )
}
