import dayjs from 'dayjs'
import { useEffect, useRef, useState } from 'react'
import { startReturn } from '../../api/piSocket'
import umbrellaIcon from '../../assets/ai-scan-umbrella.svg'
import { UmbrellaGuideOverlay } from '../../components/common/UmbrellaGuideOverlay'
import { useTranslation } from '../../i18n/useTranslation'
import { useKioskMainStore } from '../../store/kioskMainStore'
import type { ReturnEvent, ReturnResult } from '../../types/piProtocol'
import { CameraCaptureScreen } from '../common/CameraCaptureScreen'
import { ErrorScreen } from '../common/ErrorScreen'
import { LoadingScreen } from '../common/LoadingScreen'
import { ReturnCompleteScreen } from './ReturnCompleteScreen'
import { ReturnSlotScreen } from './ReturnSlotScreen'
import { UmbrellaGuideScreen } from './UmbrellaGuideScreen'
import { UmbrellaRecognizedScreen } from './UmbrellaRecognizedScreen'

const UMBRELLA_STREAM_TOKEN = import.meta.env.VITE_FACE_STREAM_TOKEN
const CAMERA_STREAM_BASE_URL = import.meta.env.VITE_CAMERA_STREAM_BASE_URL

type UiStep =
  | 'GUIDE'
  | 'CAPTURE'
  | 'CAPTURE_SUCCESS'
  | 'PROCESSING'
  | 'SLOT_GUIDE'
  | 'COMPLETED'
  | 'DAMAGED_NOTICE'
  | 'DAMAGED_CONFIRM'

// 같은 검수 결과(DAMAGED)가 연속 몇 번째부터 "재인식 or 최종 결정" 게이트 화면(CONFIRM)을 띄울지.
// 그 전(1~2회째)은 NOTICE 화면(재인식 유도 + 이대로 진행 허용).
// UNCERTAIN은 2026-08-07 사용자 결정으로 NORMAL과 완전히 동일하게 처리(별도 안내/차단 화면 없음).
const STREAK_THRESHOLD = 3

// 사용자 지정값(2026-08-07) — "우산 인식이 완료되었습니다" 체크 화면 최소 노출 시간.
// 이 화면은 검수 결과가 DAMAGED가 아닐 때만 뜨며(같은 날 사용자 결정), 뜬 뒤에는 최종 RESULT가
// 이 시간보다 먼저 도착해도 3초를 채운 뒤에야 다음 화면(SLOT_GUIDE 등)으로 전환된다.
const CAPTURE_SUCCESS_HOLD_MS = 3000

interface ReturnFlowProps {
  sessionId: string
  onBack: () => void
}

// KSK-RETURN-001(임베디드 문서 §4.5) 대응. 이전엔 촬영 안내·검수·슬롯 배정이 각각 별도
// Mock(inspectionApi/returnApi/kioskStageStream 임시 stream)이었지만, 실제로는 하나의
// Request-EVENT×N-RESULT 호출이 전체 과정을 다 실어 나른다.
export function ReturnFlow({ sessionId, onBack }: ReturnFlowProps) {
  const t = useTranslation()
  // 임베디드 문서(2026-07-31) §4.5 userMessageCode 권장 문구 — 문서에 없는 값은 일반 안내로 대체.
  const inspectionMessages: Record<string, string> = {
    SHOW_UMBRELLA: t.return.showUmbrella,
  }
  const [step, setStep] = useState<UiStep>('GUIDE')
  const [guidanceMessage, setGuidanceMessage] = useState<string | null>(null)
  const [slotNumber, setSlotNumber] = useState<number | null>(null)
  const [result, setResult] = useState<ReturnResult | null>(null)
  // TEMP: KSK-RETURN-001 RESULT 스키마에 returnedAt 필드 자체가 없음(임베디드 문서 §4.5) —
  // Spring이 반납 시각을 내려주기 전까지 RESULT 수신 시각을 클라이언트에서 임시로 찍는다.
  const [returnedAt, setReturnedAt] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const started = useRef(false)
  // DAMAGED가 연속 몇 번째인지 세는 상태 — 재인식(retryInspection)해도 초기화하지 않고
  // 이어서 센다(연속 기준, 다른 결과가 나오면 streakCount만 리셋). UNCERTAIN은 더 이상 추적 안 함.
  const lastStreakResult = useRef<'DAMAGED' | null>(null)
  const streakCount = useRef(0)
  // 한 번의 시도(startReturn 1회 호출) 안에서 RETURN_SLOT_ASSIGNED/WAITING_INSERTION/
  // SPRING_COMMITTING 이벤트가 여러 번 와도 스트릭은 1번만 반영하기 위한 가드.
  const countedThisAttempt = useRef(false)
  // NOTICE/BLOCKED/CONFIRM 화면을 띄운 뒤 사용자 결정(재인식/이대로 진행)을 기다리는 동안,
  // 같은 시도의 나머지 이벤트(WAITING_INSERTION 등)나 startReturn()의 최종 resolve가
  // 그 화면을 SLOT_GUIDE/COMPLETED로 덮어써버리는 걸 막기 위한 게이트.
  const awaitingDecision = useRef(false)
  // awaitingDecision 중에 startReturn()이 먼저 끝나버리면 결과를 여기 잠깐 보관해뒀다가,
  // 사용자가 "이대로 진행하기"를 누른 뒤 finalizeIfReady()에서 마저 반영한다.
  const pendingResult = useRef<ReturnResult | null>(null)
  // CAPTURE_SUCCESS(체크 화면) 최소 노출(CAPTURE_SUCCESS_HOLD_MS) 동안, 그보다 먼저 도착한
  // 이벤트/RESULT가 화면을 곧장 덮어쓰지 못하게 막는 게이트. hold가 끝나면 그동안 쌓인 마지막
  // 전환 하나만 적용한다.
  const captureSuccessHoldActive = useRef(false)
  const pendingAfterHold = useRef<(() => void) | null>(null)
  const holdTimerId = useRef<number | null>(null)

  const runOrDefer = (action: () => void) => {
    if (captureSuccessHoldActive.current) {
      pendingAfterHold.current = action
      return
    }
    action()
  }

  const finalizeIfReady = () => {
    if (awaitingDecision.current) return
    const returnResult = pendingResult.current
    if (!returnResult) return

    if (returnResult.terminalStatus === 'SUCCEEDED') {
      useKioskMainStore.getState().applyInventorySnapshot(returnResult.inventory)
      setResult(returnResult)
      setReturnedAt(dayjs().toISOString())
      setStep('COMPLETED')
    } else {
      setFailed(true)
    }
  }

  const handleEvent = (event: ReturnEvent) => {
    if (event.slotNumber !== null) setSlotNumber(event.slotNumber)

    switch (event.status) {
      case 'INSPECTION_GUIDE':
        setStep('CAPTURE')
        setGuidanceMessage(
          (event.userMessageCode && inspectionMessages[event.userMessageCode]) ??
            t.return.checkingUmbrella,
        )
        return
      case 'INSPECTION_PROCESSING':
        // 이 시점엔 검수 결과(DAMAGED 여부)를 아직 모른다 — "우산 인식이 완료되었습니다" 체크
        // 화면은 결과를 알고 난 뒤(DAMAGED가 아닐 때만) 아래 case에서 띄운다.
        setStep('PROCESSING')
        return
      case 'RETURN_SLOT_ASSIGNED':
      case 'WAITING_INSERTION':
      case 'SPRING_COMMITTING': {
        if (!countedThisAttempt.current && event.inspectionResult) {
          countedThisAttempt.current = true
          const result = event.inspectionResult

          if (result === 'DAMAGED') {
            streakCount.current =
              lastStreakResult.current === result ? streakCount.current + 1 : 1
            lastStreakResult.current = result
          } else {
            streakCount.current = 0
            lastStreakResult.current = null
          }

          if (result === 'DAMAGED' && streakCount.current >= STREAK_THRESHOLD) {
            awaitingDecision.current = true
            setStep('DAMAGED_CONFIRM')
            return
          }
          if (result === 'DAMAGED') {
            awaitingDecision.current = true
            setStep('DAMAGED_NOTICE')
            return
          }

          // NORMAL/UNCERTAIN(정상 처리, 2026-08-07 사용자 결정) — DAMAGED가 아닐 때만 "우산 인식이
          // 완료되었습니다" 체크 화면을 최소 CAPTURE_SUCCESS_HOLD_MS만큼 보여준 뒤 SLOT_GUIDE로 넘어간다.
          setStep('CAPTURE_SUCCESS')
          captureSuccessHoldActive.current = true
          pendingAfterHold.current = () => setStep('SLOT_GUIDE')
          holdTimerId.current = window.setTimeout(() => {
            captureSuccessHoldActive.current = false
            const pending = pendingAfterHold.current
            pendingAfterHold.current = null
            pending?.()
          }, CAPTURE_SUCCESS_HOLD_MS)
          return
        }
        // 이미 게이트 화면(NOTICE/BLOCKED/CONFIRM)을 띄운 상태라면 같은 시도의 뒤이은
        // 이벤트로 SLOT_GUIDE를 덮어쓰지 않는다.
        if (awaitingDecision.current) return
        runOrDefer(() => setStep('SLOT_GUIDE'))
        return
      }
    }
  }

  const beginReturn = () => {
    if (started.current) return
    started.current = true
    countedThisAttempt.current = false
    awaitingDecision.current = false
    pendingResult.current = null
    captureSuccessHoldActive.current = false
    pendingAfterHold.current = null
    if (holdTimerId.current !== null) {
      window.clearTimeout(holdTimerId.current)
      holdTimerId.current = null
    }

    startReturn(sessionId, handleEvent)
      .then((returnResult) => {
        pendingResult.current = returnResult
        runOrDefer(() => finalizeIfReady())
      })
      .catch((error) => {
        console.error('[Pi WS] 반납 요청 실패', error)
        if (awaitingDecision.current) return
        runOrDefer(() => setFailed(true))
      })
  }

  useEffect(() => {
    return () => {
      started.current = false
      if (holdTimerId.current !== null) {
        window.clearTimeout(holdTimerId.current)
      }
    }
  }, [])

  // NOTICE/BLOCKED 화면의 "우산 재인식하기" 공용 핸들러. 안내 화면(UmbrellaGuideScreen)은
  // 다시 보여주지 않고 촬영 화면부터 재시작한다. 진행 중이던(게이트 화면 뜬 뒤 뒤늦게 온)
  // 이전 시도 결과는 폐기한다 — beginReturn()이 pendingResult를 초기화해준다.
  const retryInspection = () => {
    started.current = false
    setStep('CAPTURE')
    beginReturn()
  }

  // NOTICE/CONFIRM 화면의 "이대로 진행하기"/"예, 반납 진행 계속하기" 공용 핸들러.
  const proceedAfterInspection = () => {
    awaitingDecision.current = false
    setStep('SLOT_GUIDE')
    finalizeIfReady()
  }

  if (failed) {
    return (
      <ErrorScreen
        title={t.return.failedTitle}
        tips={[t.deviceErrorTips.checking, t.deviceErrorTips.contactAdmin]}
        actionLabel={t.common.homeReturn}
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

  if (step === 'DAMAGED_NOTICE') {
    return (
      <ErrorScreen
        title={t.return.damagedNoticeTitle}
        subtitle={t.return.damagedNoticeSubtitle}
        actionLabel={t.return.retryInspection}
        onAction={retryInspection}
        secondaryActionLabel={t.return.proceedAnyway}
        onSecondaryAction={proceedAfterInspection}
        currentStep={3}
        flow="RETURN"
      />
    )
  }

  if (step === 'DAMAGED_CONFIRM') {
    return (
      <ErrorScreen
        title={t.return.damagedConfirmTitle}
        subtitle={t.return.damagedConfirmSubtitle}
        actionLabel={t.return.damagedConfirmYes}
        onAction={proceedAfterInspection}
        secondaryActionLabel={t.return.retryInspection}
        onSecondaryAction={retryInspection}
        currentStep={3}
        flow="RETURN"
      />
    )
  }

  if (step === 'SLOT_GUIDE' && slotNumber !== null) {
    return (
      <ReturnSlotScreen slotNumber={slotNumber} onBack={onBack} />
    )
  }

  if (step === 'CAPTURE_SUCCESS') {
    return <UmbrellaRecognizedScreen />
  }

  if (step === 'PROCESSING') {
    return (
      <LoadingScreen
        title={t.return.checkingUmbrella}
        subtitle={t.common.pleaseWait}
        icon={umbrellaIcon}
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
        resetSignal={guidanceMessage}
      />
    )
  }

  return <UmbrellaGuideScreen onBack={onBack} onAction={beginReturn} />
}
