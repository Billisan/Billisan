import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { startRent } from '../../api/piSocket'
import { useTranslation } from '../../i18n/useTranslation'
import type { RentResult } from '../../types/piProtocol'
import { ErrorScreen } from '../common/ErrorScreen'
import { LoadingScreen } from '../common/LoadingScreen'
import { PickupSlotScreen } from './PickupSlotScreen'
import { RentalCompleteScreen } from './RentalCompleteScreen'

// PROJECT_GUIDE.md §4 "무료 대여 시간 24시간" 기준 임시 폴백.
const FREE_RENTAL_HOURS = 24

interface RentFlowProps {
  sessionId: string
  onBack: () => void
}

// KSK-RENT-001(임베디드 문서 §4.4) 대응. Mock rentalApi.ts를 대체한다.
// "꺼냈어요"는 09-screen-flow.md상 USER_CONFIRMED_PICKUP_GUIDE(로컬 확인 신호일 뿐 완료 API 아님) —
// 실제 완료는 서버가 물리 제거를 감지해 보내는 RESULT(terminalStatus=SUCCEEDED)로만 판단한다.
export function RentFlow({ sessionId, onBack }: RentFlowProps) {
  const t = useTranslation()
  const [slotNumber, setSlotNumber] = useState<number | null>(null)
  const [result, setResult] = useState<RentResult | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    startRent(sessionId, (event) => {
      if (cancelled) return
      if (event.slotNumber !== null) setSlotNumber(event.slotNumber)
    })
      .then((rentResult) => {
        if (cancelled) return
        if (rentResult.terminalStatus === 'SUCCEEDED') {
          setResult(rentResult)
        } else {
          setFailed(true)
        }
      })
      .catch((error) => {
        if (cancelled) return
        console.error('[Pi WS] 대여 요청 실패', error)
        setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [sessionId])

  if (failed) {
    return (
      <ErrorScreen
        title={t.rent.failedTitle}
        tips={[t.deviceErrorTips.checking, t.deviceErrorTips.contactAdmin]}
        actionLabel={t.common.homeReturn}
        onAction={onBack}
        currentStep={3}
        flow="RENT"
      />
    )
  }

  if (result) {
    // TEMP: Spring 미연동이라 rentalSummary.rentedAt/dueAt이 항상 null(임베디드 문서 §4.4 명시) —
    // Spring 연동 전까지 클라이언트 시각으로 임시 표시한다(서버 확정값 아님, 연동되면 이 폴백 제거).
    const rentedAt = result.rentalSummary?.rentedAt ?? dayjs().toISOString()
    const dueAt =
      result.rentalSummary?.dueAt ??
      dayjs(rentedAt).add(FREE_RENTAL_HOURS, 'hour').toISOString()

    return (
      <RentalCompleteScreen
        rentedAt={rentedAt}
        dueAt={dueAt}
        onConfirm={onBack}
      />
    )
  }

  if (slotNumber !== null) {
    return (
      <PickupSlotScreen slotNumber={slotNumber} onBack={onBack} />
    )
  }

  return (
    <LoadingScreen
      title={t.rent.preparingTitle}
      subtitle={t.common.pleaseWait}
      currentStep={3}
      flow="RENT"
    />
  )
}
