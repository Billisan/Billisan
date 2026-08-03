import { useState } from 'react'
import { AuthScreen } from './screens/SCR-KSK-AUTH-001/AuthScreen'
import { MainScreen } from './screens/SCR-KSK-MAIN-001/MainScreen'
import { RentFlow } from './screens/SCR-KSK-RENT-001/RentFlow'
import { ReturnFlow } from './screens/SCR-KSK-RETURN-001/ReturnFlow'
import { useFaceAuthStore } from './store/faceAuthStore'
import { useKioskFlowStore } from './store/kioskFlowStore'
import { useKioskMainStore } from './store/kioskMainStore'
import type { RentalBlockReason } from './types/eligibility'
import { SCREEN_ID } from './types/screen'

type Mode = 'RENT' | 'RETURN'

function App() {
  const currentScreen = useKioskFlowStore((state) => state.currentScreen)
  const goTo = useKioskFlowStore((state) => state.goTo)
  const resetFaceAuth = useFaceAuthStore((state) => state.reset)
  const setRentalBlockReason = useKioskMainStore(
    (state) => state.setRentalBlockReason,
  )
  const [mode, setMode] = useState<Mode>('RENT')
  const [sessionId, setSessionId] = useState<string | null>(null)

  const goToMain = () => {
    resetFaceAuth()
    setSessionId(null)
    goTo(SCREEN_ID.MAIN)
  }

  // 자격 판정은 faceAuthStore가 수신한 ELIGIBILITY_RESULT stage로 끝난 상태다.
  // KSK-SESSION-001이 발급한 sessionId를 이후 RENT/RETURN Operation에 그대로 재사용한다(문서 §5).
  const handleAuthenticated = (openedSessionId: string) => {
    setSessionId(openedSessionId)
    goTo(mode === 'RENT' ? SCREEN_ID.RENT : SCREEN_ID.RETURN)
  }

  const handleEligibilityBlocked = (reason: RentalBlockReason) => {
    setRentalBlockReason(reason)
    goToMain()
  }

  if (currentScreen === SCREEN_ID.AUTH) {
    return (
      <AuthScreen
        onBack={goToMain}
        onAuthenticated={handleAuthenticated}
        onEligibilityBlocked={handleEligibilityBlocked}
        mode={mode}
      />
    )
  }

  if (currentScreen === SCREEN_ID.RENT && sessionId !== null) {
    return <RentFlow sessionId={sessionId} onBack={goToMain} />
  }

  if (currentScreen === SCREEN_ID.RETURN && sessionId !== null) {
    return <ReturnFlow sessionId={sessionId} onBack={goToMain} />
  }

  return (
    <MainScreen
      onRent={() => {
        setMode('RENT')
        goTo(SCREEN_ID.AUTH)
      }}
      onReturn={() => {
        setMode('RETURN')
        goTo(SCREEN_ID.AUTH)
      }}
    />
  )
}

export default App
