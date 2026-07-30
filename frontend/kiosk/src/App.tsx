import { useState } from 'react'
import { startRental, type RentalStart } from './api/rentalApi'
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
  const [rental, setRental] = useState<RentalStart | null>(null)

  const goToMain = () => {
    resetFaceAuth()
    setRental(null)
    goTo(SCREEN_ID.MAIN)
  }

  // 자격 판정은 faceAuthStore가 수신한 ELIGIBILITY_RESULT stage로 끝난 상태다.
  // 슬롯 배정은 기존 대여 flow Mock을 유지한다.
  const handleRentAuthenticated = async () => {
    const startResult = await startRental()
    setRental(startResult)
    goTo(SCREEN_ID.RENT)
  }

  const handleReturnAuthenticated = () => {
    goTo(SCREEN_ID.RETURN)
  }

  const handleEligibilityBlocked = (reason: RentalBlockReason) => {
    setRentalBlockReason(reason)
    goToMain()
  }

  if (currentScreen === SCREEN_ID.AUTH) {
    return (
      <AuthScreen
        onBack={goToMain}
        onAuthenticated={
          mode === 'RENT' ? handleRentAuthenticated : handleReturnAuthenticated
        }
        onEligibilityBlocked={handleEligibilityBlocked}
        mode={mode}
      />
    )
  }

  if (currentScreen === SCREEN_ID.RENT && rental !== null) {
    return <RentFlow rental={rental} onBack={goToMain} />
  }

  if (currentScreen === SCREEN_ID.RETURN) {
    return <ReturnFlow onBack={goToMain} />
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
