import type { NavigatorScreenParams } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Text, View } from 'react-native'
import { ChatbotScreen } from '../screens/SCR-APP-CHATBOT-001/ChatbotScreen'
import type { TabParamList } from './TabNavigator'
import { TabNavigator } from './TabNavigator'

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>
  Chatbot: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

// "빌리" + "AI 어시스턴트 · 온라인"(초록 점) 2줄 헤더 타이틀(목업 반영, 2026-08-05).
// 초록 점은 프로젝트 팔레트에 온라인 상태색이 없어 Tailwind 기본 green-500을 그대로 사용(사용자 확인).
function ChatbotHeaderTitle() {
  return (
    <View className="items-center">
      <Text className="text-lg font-bold text-text">빌리</Text>
      <View className="flex-row items-center gap-1">
        <View className="h-1.5 w-1.5 rounded-full bg-green-500" />
        <Text className="text-xs text-text-secondary">AI 어시스턴트 · 온라인</Text>
      </View>
    </View>
  )
}

// 하단 탭 바깥에서 접근하는 화면(챗봇)을 위한 최상위 스택. 탭 자체는 headerShown: false로 두고,
// Chatbot만 Inquiry 화면과 동일하게 네이티브 기본 헤더 + minimal 뒤로가기를 쓴다(2026-08-05 확인).
export function RootStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen
        name="Chatbot"
        component={ChatbotScreen}
        options={{ headerTitle: ChatbotHeaderTitle, headerBackButtonDisplayMode: 'minimal' }}
      />
    </Stack.Navigator>
  )
}
