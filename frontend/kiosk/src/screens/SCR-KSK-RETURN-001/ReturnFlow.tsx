import { useState } from 'react'
import { inspectUmbrella } from '../../api/inspectionApi'
import { startReturn, type ReturnStart } from '../../api/returnApi'
import umbrellaIcon from '../../assets/ai-scan-umbrella.svg'
import { LoadingScreen } from '../common/LoadingScreen'
import type { InspectionResult } from '../../types/inspection'
import { ReturnCaptureScreen } from './ReturnCaptureScreen'
import { ReturnCompleteScreen } from './ReturnCompleteScreen'
import { ReturnSlotScreen } from './ReturnSlotScreen'
import { UmbrellaGuideScreen } from './UmbrellaGuideScreen'

type ReturnStep = 'GUIDE' | 'CAPTURE' | 'PROCESSING' | 'SLOT_GUIDE' | 'COMPLETED'

interface ReturnFlowProps {
  onBack: () => void
}

export function ReturnFlow({ onBack }: ReturnFlowProps) {
  const [returnStep, setReturnStep] = useState<ReturnStep>('GUIDE')
  const [inspectionResult, setInspectionResult] =
    useState<InspectionResult | null>(null)
  const [returnResult, setReturnResult] = useState<ReturnStart | null>(null)

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

  if (returnStep === 'GUIDE') {
    return (
      <UmbrellaGuideScreen
        onBack={onBack}
        onAction={() => setReturnStep('CAPTURE')}
      />
    )
  }

  if (returnStep === 'CAPTURE') {
    return <ReturnCaptureScreen onBack={onBack} onCaptured={handleCaptured} />
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
        onBack={onBack}
        onAction={handleInserted}
      />
    )
  }

  if (returnStep === 'COMPLETED' && inspectionResult !== null && returnResult !== null) {
    return (
      <ReturnCompleteScreen
        inspectionResult={inspectionResult}
        returnedAt={returnResult.returnedAt}
        onConfirm={onBack}
      />
    )
  }

  return null
}
