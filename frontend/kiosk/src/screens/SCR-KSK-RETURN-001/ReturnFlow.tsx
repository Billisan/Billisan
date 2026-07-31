import dayjs from 'dayjs'
import { useEffect, useRef, useState } from 'react'
import { startReturn } from '../../api/piSocket'
import { UmbrellaGuideOverlay } from '../../components/common/UmbrellaGuideOverlay'
import type { ReturnEvent, ReturnResult } from '../../types/piProtocol'
import { CameraCaptureScreen } from '../common/CameraCaptureScreen'
import { ErrorScreen } from '../common/ErrorScreen'
import { LoadingScreen } from '../common/LoadingScreen'
import { ReturnCompleteScreen } from './ReturnCompleteScreen'
import { ReturnSlotScreen } from './ReturnSlotScreen'
import { UmbrellaGuideScreen } from './UmbrellaGuideScreen'

const UMBRELLA_STREAM_TOKEN = import.meta.env.VITE_FACE_STREAM_TOKEN
const CAMERA_STREAM_BASE_URL = import.meta.env.VITE_CAMERA_STREAM_BASE_URL

// 임베디드 문서(2026-07-31) §4.5 userMessageCode 권장 문구 — 문서에 없는 값은 일반 안내로 대체.
const INSPECTION_MESSAGES: Record<string, string> = {
  SHOW_UMBRELLA: '우산을 카메라에 잘 보이게 들어주세요',
}

type UiStep = 'GUIDE' | 'CAPTURE' | 'PROCESSING' | 'SLOT_GUIDE' | 'COMPLETED'

interface ReturnFlowProps {
  sessionId: string
  onBack: () => void
}

// KSK-RETURN-001(임베디드 문서 §4.5) 대응. 이전엔 촬영 안내·검수·슬롯 배정이 각각 별도
// Mock(inspectionApi/returnApi/kioskStageStream 임시 stream)이었지만, 실제로는 하나의
// Request-EVENT×N-RESULT 호출이 전체 과정을 다 실어 나른다.
export function ReturnFlow({ sessionId, onBack }: ReturnFlowProps) {
  const [step, setStep] = useState<UiStep>('GUIDE')
  const [guidanceMessage, setGuidanceMessage] = useState<string | null>(null)
  const [slotNumber, setSlotNumber] = useState<number | null>(null)
  const [result, setResult] = useState<ReturnResult | null>(null)
  // TEMP: KSK-RETURN-001 RESULT 스키마에 returnedAt 필드 자체가 없음(임베디드 문서 §4.5) —
  // Spring이 반납 시각을 내려주기 전까지 RESULT 수신 시각을 클라이언트에서 임시로 찍는다.
  const [returnedAt, setReturnedAt] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const started = useRef(false)

  const handleEvent = (event: ReturnEvent) => {
    if (event.slotNumber !== null) setSlotNumber(event.slotNumber)

    switch (event.status) {
      case 'INSPECTION_GUIDE':
        setStep('CAPTURE')
        setGuidanceMessage(
          (event.userMessageCode && INSPECTION_MESSAGES[event.userMessageCode]) ??
            '우산 상태를 확인하고 있어요',
        )
        return
      case 'INSPECTION_PROCESSING':
        setStep('PROCESSING')
        return
      case 'RETURN_SLOT_ASSIGNED':
      case 'WAITING_INSERTION':
      case 'SPRING_COMMITTING':
        setStep('SLOT_GUIDE')
        return
    }
  }

  const beginReturn = () => {
    if (started.current) return
    started.current = true

    startReturn(sessionId, handleEvent)
      .then((returnResult) => {
        if (returnResult.terminalStatus === 'SUCCEEDED') {
          setResult(returnResult)
          setReturnedAt(dayjs().toISOString())
          setStep('COMPLETED')
        } else {
          setFailed(true)
        }
      })
      .catch((error) => {
        console.error('[Pi WS] 반납 요청 실패', error)
        setFailed(true)
      })
  }

  useEffect(() => {
    return () => {
      started.current = false
    }
  }, [])

  if (failed) {
    return (
      <ErrorScreen
        title="반납을 완료하지 못했습니다"
        tips={[
          '우산함 상태를 확인 중입니다.',
          '문제가 계속되면 관리자에게 문의해주세요.',
        ]}
        actionLabel="홈으로 돌아가기"
        onAction={onBack}
        currentStep={3}
        flow="RETURN"
      />
    )
  }

  if (step === 'COMPLETED' && result) {
    return (
      <ReturnCompleteScreen
        inspectionResult={result.inspectionResult}
        returnedAt={returnedAt}
        onConfirm={onBack}
      />
    )
  }

  if (step === 'SLOT_GUIDE' && slotNumber !== null) {
    return (
      <ReturnSlotScreen slotNumber={slotNumber} onBack={onBack} />
    )
  }

  if (step === 'PROCESSING') {
    return (
      <LoadingScreen
        title="우산 상태를 확인하고 있어요"
        subtitle="잠시만 기다려주세요"
        currentStep={3}
        flow="RETURN"
      />
    )
  }

  if (step === 'CAPTURE') {
    return (
      <CameraCaptureScreen
        streamUrl={`${CAMERA_STREAM_BASE_URL}?token=${encodeURIComponent(UMBRELLA_STREAM_TOKEN)}`}
        guide={<UmbrellaGuideOverlay message={guidanceMessage} />}
        onBack={onBack}
        currentStep={3}
        flow="RETURN"
      />
    )
  }

  return <UmbrellaGuideScreen onBack={onBack} onAction={beginReturn} />
}
