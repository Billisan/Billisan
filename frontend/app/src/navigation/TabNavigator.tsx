import { MaterialCommunityIcons } from '@expo/vector-icons'
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type { NavigatorScreenParams } from '@react-navigation/native'
import { Pressable } from 'react-native'
import { HistoryScreen } from '../screens/SCR-APP-HISTORY-001/HistoryScreen'
import { HomeScreen } from '../screens/SCR-APP-HOME-001/HomeScreen'
import { MapScreen } from '../screens/SCR-APP-STATION-001/MapScreen'
import type { MyPageStackParamList } from './MyPageStackNavigator'
import { MyPageStackNavigator } from './MyPageStackNavigator'

export type TabParamList = {
  Home: undefined
  Map: undefined
  History: undefined
  MyPage: NavigatorScreenParams<MyPageStackParamList>
}

const Tab = createBottomTabNavigator<TabParamList>()

// 활성 탭 필(pill)에 테두리를 주고 높이를 키우기 위한 커스텀 tabBarButton(2026-08-05 사용자 확인) —
// tabBarActiveBackgroundColor만으로는 border를 줄 수 없다. React Navigation이 이 커스텀 버튼에
// focused 여부를 accessibilityState가 아니라 'aria-selected' prop으로 전달해서 그걸로 판정한다.
// 2026-08-07 추가 확인 — BottomTabItem.tsx가 활성 배경색에 적용하는 borderRadius를 variant(기본값
// 'uikit')별로 자체 계산해 0으로 강제 덮어써서(node_modules 소스 확인), tabBarItemStyle에 준
// borderRadius가 무시되고 있었다. 여기서 style 배열 마지막에 명시적으로 다시 얹어 덮어쓴다.
function TabBarButton({ children, style, ref: _ref, ...rest }: BottomTabBarButtonProps) {
  const focused = rest['aria-selected'] === true

  return (
    <Pressable
      {...rest}
      style={[
        style,
        {
          height: 34,
          borderRadius: 16,
          // paddingHorizontal: 4,
        },
      ]}
    >
      {children}
    </Pressable>
  )
}

// 2026-07-31 사용자 와이어프레임(PDF) 확인 후 하단 탭을 홈/지도/내역조회/마이페이지로 변경.
// 챗봇(SCR-APP-CHATBOT-001)은 탭이 아니라 홈 화면 안의 플로팅 버튼으로 들어가는 구조라
// 탭에서 뺐다 — 실제 연결은 홈 화면 구현(Phase 3)에서 마저 진행한다.
// 2026-08-04: 실제 탭 바 목업 스크린샷 확인 후 반영 — 아이콘은 포커스와 무관하게 아웃라인 계열로
// 고정(마이페이지만 원본 목업처럼 채워진 사람 아이콘), 활성 탭은 배경색(밑줄/필 형태)으로만 구분한다.
export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1E2A38',
        tabBarInactiveTintColor: '#5F5E5E',
        tabBarActiveBackgroundColor: '#FFEDC0',
        tabBarItemStyle: { marginHorizontal: 6, marginVertical: 0, borderRadius: 20 },
        tabBarButton: (props) => <TabBarButton {...props} />,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: '홈',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="home-outline" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          title: '지도',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="map-outline" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: '내역조회',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="history" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="MyPage"
        component={MyPageStackNavigator}
        options={{
          title: '마이페이지',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="account" size={24} color={color} />,
        }}
      />
    </Tab.Navigator>
  )
}
