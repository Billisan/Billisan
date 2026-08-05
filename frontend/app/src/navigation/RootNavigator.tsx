import { NavigationContainer } from '@react-navigation/native'
import { LoginScreen } from '../screens/SCR-APP-AUTH-001/LoginScreen'
import { useAuthStore } from '../store/useAuthStore'
import { RootStackNavigator } from './RootStackNavigator'

// 로그인 전에는 탭 화면을 아예 마운트하지 않는다(비로그인 상태에서 탭 화면의
// API 호출이 일어나지 않도록).
export function RootNavigator() {
  const accessToken = useAuthStore((state) => state.accessToken)

  return (
    <NavigationContainer>
      {accessToken ? <RootStackNavigator /> : <LoginScreen />}
    </NavigationContainer>
  )
}
