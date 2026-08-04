import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { InquiryScreen } from '../screens/SCR-APP-INQUIRY-001/InquiryScreen'
import { MyPageScreen } from '../screens/SCR-APP-MYPAGE-001/MyPageScreen'

export type MyPageStackParamList = {
  MyPageHome: undefined
  Inquiry: undefined
}

const Stack = createNativeStackNavigator<MyPageStackParamList>()

// 마이페이지 탭 안에서만 문의하기로 push/back한다. MyPageHome은 Home과 같은 자체 헤더(로고·학교명·
// 알림 아이콘)를 그리므로 네이티브 헤더를 끄고, Inquiry는 뒤로가기가 필요해 네이티브 스택 기본
// 헤더를 그대로 쓴다(2026-08-04, 목업 확인 후 결정).
export function MyPageStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MyPageHome"
        component={MyPageScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="Inquiry" component={InquiryScreen} options={{ title: '문의하기' }} />
    </Stack.Navigator>
  )
}
