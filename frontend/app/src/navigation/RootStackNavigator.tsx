import type { NavigatorScreenParams } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ChatbotScreen } from '../screens/SCR-APP-CHATBOT-001/ChatbotScreen'
import type { TabParamList } from './TabNavigator'
import { TabNavigator } from './TabNavigator'

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>
  Chatbot: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

// 하단 탭 바깥에서 접근하는 화면(챗봇)을 위한 최상위 스택. 탭 자체는 headerShown: false로 두고,
// Chatbot만 Inquiry 화면과 동일하게 네이티브 기본 헤더 + minimal 뒤로가기를 쓴다(2026-08-05 확인).
export function RootStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen
        name="Chatbot"
        component={ChatbotScreen}
        options={{ title: '빌리 챗봇', headerBackButtonDisplayMode: 'minimal' }}
      />
    </Stack.Navigator>
  )
}
