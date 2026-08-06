import { NavigationContainer } from '@react-navigation/native'
import { useEffect } from 'react'
import { LoadingScreen } from '../components/common/LoadingScreen'
import { LoginScreen } from '../screens/SCR-APP-AUTH-001/LoginScreen'
import { useAuthStore } from '../store/useAuthStore'
import { RootStackNavigator } from './RootStackNavigator'

// 로그인 전에는 탭 화면을 아예 마운트하지 않는다(비로그인 상태에서 탭 화면의
// API 호출이 일어나지 않도록). 부팅 직후에는 SecureStore에서 토큰 복원이 끝날 때까지
// 로딩 화면을 보여준다(2026-08-06, 실제 Spring 연동).
export function RootNavigator() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const isHydrating = useAuthStore((state) => state.isHydrating)
  const hydrate = useAuthStore((state) => state.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  if (isHydrating) {
    return <LoadingScreen message="로그인 정보를 확인하는 중이에요" />
  }

  return (
    <NavigationContainer>
      {accessToken ? <RootStackNavigator /> : <LoginScreen />}
    </NavigationContainer>
  )
}
