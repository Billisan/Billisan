import { AuthScreen } from './screens/SCR-KSK-AUTH-001/AuthScreen'
import { MainScreen } from './screens/SCR-KSK-MAIN-001/MainScreen'
import { useFaceAuthStore } from './store/faceAuthStore'
import { useKioskFlowStore } from './store/kioskFlowStore'
import { SCREEN_ID } from './types/screen'

function App() {
  const currentScreen = useKioskFlowStore((state) => state.currentScreen)
  const goTo = useKioskFlowStore((state) => state.goTo)
  const resetFaceAuth = useFaceAuthStore((state) => state.reset)

  const goToMain = () => {
    resetFaceAuth()
    goTo(SCREEN_ID.MAIN)
  }

  if (currentScreen === SCREEN_ID.AUTH) {
    return (
      <AuthScreen
        onBack={goToMain}
        // 인증 성공(MATCHED) 후 다음 화면(SCR-KSK-RENT-001)은 다음 PLAN에서 구현 — 지금은 연결 지점만 마련
        onAuthenticated={() => {}}
      />
    )
  }

  return <MainScreen onRent={() => goTo(SCREEN_ID.AUTH)} />
}

export default App
