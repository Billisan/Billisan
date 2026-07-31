import { useState } from 'react'
import { checkRentalEligibility } from './api/eligibilityApi'
import { inspectUmbrella } from './api/inspectionApi'
import { startRental, type RentalStart } from './api/rentalApi'
import { startReturn, type ReturnStart } from './api/returnApi'
import { checkActiveRentalForReturn } from './api/returnEligibilityApi'
import umbrellaIcon from './assets/ai-scan-umbrella.svg'
import { AuthScreen } from './screens/SCR-KSK-AUTH-001/AuthScreen'
import { MainScreen } from './screens/SCR-KSK-MAIN-001/MainScreen'
import { PickupSlotScreen } from './screens/SCR-KSK-RENT-001/PickupSlotScreen'
import { RentalCompleteScreen } from './screens/SCR-KSK-RENT-001/RentalCompleteScreen'
import { ReturnCaptureScreen } from './screens/SCR-KSK-RETURN-001/ReturnCaptureScreen'
import { ReturnCompleteScreen } from './screens/SCR-KSK-RETURN-001/ReturnCompleteScreen'
import { ReturnSlotScreen } from './screens/SCR-KSK-RETURN-001/ReturnSlotScreen'
import { UmbrellaGuideScreen } from './screens/SCR-KSK-RETURN-001/UmbrellaGuideScreen'
import { LoadingScreen } from './screens/common/LoadingScreen'
import { useFaceAuthStore } from './store/faceAuthStore'
import { useKioskFlowStore } from './store/kioskFlowStore'
import { useKioskMainStore } from './store/kioskMainStore'
import { RENTAL_BLOCK_REASON, RENTAL_ELIGIBILITY_RESULT } from './types/eligibility'
import type { InspectionResult } from './types/inspection'
import { SCREEN_ID } from './types/screen'

type Mode = 'RENT' | 'RETURN'
type ReturnStep = 'GUIDE' | 'CAPTURE' | 'PROCESSING' | 'SLOT_GUIDE' | 'COMPLETED'

function App() {
  const currentScreen = useKioskFlowStore((state) => state.currentScreen)
  const goTo = useKioskFlowStore((state) => state.goTo)
  const resetFaceAuth = useFaceAuthStore((state) => state.reset)
  const setRentalBlockReason = useKioskMainStore(
    (state) => state.setRentalBlockReason,
  )
  const [mode, setMode] = useState<Mode>('RENT')
  const [rental, setRental] = useState<RentalStart | null>(null)
  const [isPickedUp, setIsPickedUp] = useState(false)
  const [returnStep, setReturnStep] = useState<ReturnStep>('GUIDE')
  const [inspectionResult, setInspectionResult] =
    useState<InspectionResult | null>(null)
  const [returnResult, setReturnResult] = useState<ReturnStart | null>(null)

  const goToMain = () => {
    resetFaceAuth()
    setRental(null)
    setIsPickedUp(false)
    setReturnStep('GUIDE')
    setInspectionResult(null)
    setReturnResult(null)
    goTo(SCREEN_ID.MAIN)
  }

  // 09-screen-flow.md §4.1 "Spring 정책 검증" 대응 — 얼굴 매칭 성공 후 대여 자격을 확인한다.
  const handleRentAuthenticated = async () => {
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

  // 09-screen-flow.md §4.1 "활성 대여 확인" 대응 — 얼굴 매칭 성공 후 반납 대상이 있는지 확인한다.
  const handleReturnAuthenticated = async () => {
    const result = await checkActiveRentalForReturn()

    if (result !== 'FOUND') {
      setRentalBlockReason(RENTAL_BLOCK_REASON.ACTIVE_RENTAL_NOT_FOUND)
      goToMain()
      return
    }

    setReturnStep('GUIDE')
    goTo(SCREEN_ID.RETURN)
  }

  // 09-screen-flow.md §3.4 UMBRELLA_CAPTURE → INSPECTION_PROCESSING → RETURN_SLOT_GUIDE 대응.
  // "AI 결과 기록 후에만 원자 선정"이라 검수 결과를 먼저 받은 뒤에 슬롯을 배정한다.
  const handleCaptured = async () => {
    setReturnStep('PROCESSING')

    const result = await inspectUmbrella()
    setInspectionResult(result)

    const startResult = await startReturn()
    setReturnResult(startResult)
    setReturnStep('SLOT_GUIDE')
  }

  const handleInserted = () => setReturnStep('COMPLETED')

  if (currentScreen === SCREEN_ID.AUTH) {
    return (
      <AuthScreen
        onBack={goToMain}
        onAuthenticated={
          mode === 'RENT' ? handleRentAuthenticated : handleReturnAuthenticated
        }
        mode={mode}
      />
    )
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

  if (currentScreen === SCREEN_ID.RETURN) {
    if (returnStep === 'GUIDE') {
      return (
        <UmbrellaGuideScreen
          onBack={goToMain}
          onAction={() => setReturnStep('CAPTURE')}
        />
      )
    }

    if (returnStep === 'CAPTURE') {
      return <ReturnCaptureScreen onBack={goToMain} onCaptured={handleCaptured} />
    }

    if (returnStep === 'PROCESSING') {
      return (
        <LoadingScreen
          title="우산 상태를 확인하고 있어요"
          subtitle="잠시만 기다려주세요"
          icon={umbrellaIcon}
          currentStep={3}
          flow="RETURN"
        />
      )
    }

    if (returnStep === 'SLOT_GUIDE' && returnResult !== null) {
      return (
        <ReturnSlotScreen
          slotNumber={returnResult.slotNumber}
          onBack={goToMain}
          onAction={handleInserted}
        />
      )
    }

    if (returnStep === 'COMPLETED' && inspectionResult !== null && returnResult !== null) {
      return (
        <ReturnCompleteScreen
          inspectionResult={inspectionResult}
          returnedAt={returnResult.returnedAt}
          onConfirm={goToMain}
        />
      )
    }
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
