import { useState } from 'react'
import { checkRentalEligibility } from './api/eligibilityApi'
import { startRental, type RentalStart } from './api/rentalApi'
import { AuthScreen } from './screens/SCR-KSK-AUTH-001/AuthScreen'
import { MainScreen } from './screens/SCR-KSK-MAIN-001/MainScreen'
import { PickupSlotScreen } from './screens/SCR-KSK-RENT-001/PickupSlotScreen'
import { RentalCompleteScreen } from './screens/SCR-KSK-RENT-001/RentalCompleteScreen'
import { useFaceAuthStore } from './store/faceAuthStore'
import { useKioskFlowStore } from './store/kioskFlowStore'
import { useKioskMainStore } from './store/kioskMainStore'
import { RENTAL_ELIGIBILITY_RESULT } from './types/eligibility'
import { SCREEN_ID } from './types/screen'

function App() {
  const currentScreen = useKioskFlowStore((state) => state.currentScreen)
  const goTo = useKioskFlowStore((state) => state.goTo)
  const resetFaceAuth = useFaceAuthStore((state) => state.reset)
  const setRentalBlockReason = useKioskMainStore(
    (state) => state.setRentalBlockReason,
  )
  const [rental, setRental] = useState<RentalStart | null>(null)
  const [isPickedUp, setIsPickedUp] = useState(false)

  const goToMain = () => {
    resetFaceAuth()
    setRental(null)
    setIsPickedUp(false)
    goTo(SCREEN_ID.MAIN)
  }

  // 09-screen-flow.md §4.1 "Spring 정책 검증" 대응 — 얼굴 매칭 성공 후 대여 자격을 확인한다.
  const handleAuthenticated = async () => {
    const result = await checkRentalEligibility()

    if (result !== RENTAL_ELIGIBILITY_RESULT.ELIGIBLE) {
      setRentalBlockReason(result)
      goToMain()
      return
    }

    const startResult = await startRental()
    setRental(startResult)
    goTo(SCREEN_ID.RENT)
  }

  if (currentScreen === SCREEN_ID.AUTH) {
    return <AuthScreen onBack={goToMain} onAuthenticated={handleAuthenticated} />
  }

  if (currentScreen === SCREEN_ID.RENT && rental !== null) {
    if (!isPickedUp) {
      return (
        <PickupSlotScreen
          slotNumber={rental.slotNumber}
          onBack={goToMain}
          onAction={() => setIsPickedUp(true)}
        />
      )
    }

    return (
      <RentalCompleteScreen
        rentedAt={rental.rentedAt}
        dueAt={rental.dueAt}
        onConfirm={goToMain}
      />
    )
  }

  return <MainScreen onRent={() => goTo(SCREEN_ID.AUTH)} />
}

export default App
