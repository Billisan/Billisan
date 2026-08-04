import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { HistoryScreen } from '../screens/SCR-APP-HISTORY-001/HistoryScreen'
import { HomeScreen } from '../screens/SCR-APP-HOME-001/HomeScreen'
import { MyPageScreen } from '../screens/SCR-APP-MYPAGE-001/MyPageScreen'
import { MapScreen } from '../screens/SCR-APP-STATION-001/MapScreen'

const Tab = createBottomTabNavigator()

// 2026-07-31 사용자 와이어프레임(PDF) 확인 후 하단 탭을 홈/지도/내역조회/마이페이지로 변경.
// 챗봇(SCR-APP-CHATBOT-001)은 탭이 아니라 홈 화면 안의 플로팅 버튼으로 들어가는 구조라
// 탭에서 뺐다 — 실제 연결은 홈 화면 구현(Phase 3)에서 마저 진행한다.
export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FFD700',
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '홈' }} />
      <Tab.Screen name="Map" component={MapScreen} options={{ title: '지도' }} />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: '내역조회' }}
      />
      <Tab.Screen
        name="MyPage"
        component={MyPageScreen}
        options={{ title: '마이페이지' }}
      />
    </Tab.Navigator>
  )
}
