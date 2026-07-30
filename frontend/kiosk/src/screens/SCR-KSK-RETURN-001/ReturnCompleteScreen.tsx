import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import checkCircleIcon from '../../assets/check-circle.svg'
import { KioskLayout } from '../../components/layout/KioskLayout'
import {
  INSPECTION_RESULT,
  type InspectionResult,
} from '../../types/inspection'

interface ReturnCompleteScreenProps {
  inspectionResult: InspectionResult
  returnedAt: string
  onConfirm: () => void
}

const AUTO_CONFIRM_SECONDS = 5

// PROJECT_GUIDE.md §6 "반납 결과 표현 규칙" — 확정 파손·비용 문구는 절대 노출하지 않는다.
const RESULT_MESSAGE: Record<InspectionResult, string> = {
  [INSPECTION_RESULT.NORMAL]: '반납이 완료되었습니다.',
  [INSPECTION_RESULT.DAMAGED]:
    '반납은 완료되었으며 우산 상태는 관리자가 확인합니다.',
  [INSPECTION_RESULT.UNCERTAIN]:
    '반납은 완료되었으며 우산 상태는 관리자가 확인합니다.',
  [INSPECTION_RESULT.FAILED]:
    '반납은 완료되었으며 우산 상태는 관리자가 확인합니다.',
}

export function ReturnCompleteScreen({
  inspectionResult,
  returnedAt,
  onConfirm,
}: ReturnCompleteScreenProps) {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CONFIRM_SECONDS)

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (secondsLeft <= 0) onConfirm()
  }, [secondsLeft, onConfirm])

  return (
    <KioskLayout currentStep={4} flow="RETURN">
      <div className="flex w-full flex-col items-center gap-14">
        <div className="flex flex-col items-center gap-6">
          <img src={checkCircleIcon} alt="" className="h-40 w-40" />
          <h2 className="text-3xl font-bold text-black">반납 완료!</h2>
          <p className="text-tertiary-text max-w-100 text-center text-lg">
            {RESULT_MESSAGE[inspectionResult]}
          </p>

          <div className="border-disabled flex w-100 flex-col items-center gap-1 rounded-2xl border bg-white py-6">
            <span className="text-lg font-bold text-black">반납 시각</span>
            <span className="text-tertiary-text text-base">
              {dayjs(returnedAt).format('YYYY-MM-DD')}
            </span>
            <span className="text-tertiary-text text-base">
              {dayjs(returnedAt).format('A h:mm')}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="bg-primary flex h-18 w-18 items-center justify-center rounded-full">
            <span className="text-3xl font-bold text-white">{secondsLeft}</span>
          </div>
          <p className="text-tertiary-text text-base">
            5초 후 자동으로 홈 화면으로 돌아갑니다
          </p>

          <button
            type="button"
            onClick={onConfirm}
            className="bg-primary h-18 w-100 rounded-2xl text-2xl font-bold text-white transition-colors active:brightness-95"
          >
            홈으로
          </button>
        </div>
      </div>
    </KioskLayout>
  )
}
