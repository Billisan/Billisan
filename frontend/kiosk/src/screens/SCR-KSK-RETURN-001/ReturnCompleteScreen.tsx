import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import checkCircleIcon from '../../assets/check-circle.svg'
import { KioskLayout } from '../../components/layout/KioskLayout'
import { useTranslation } from '../../i18n/useTranslation'
import {
  INSPECTION_RESULT,
  type InspectionResult,
} from '../../types/inspection'

interface ReturnCompleteScreenProps {
  inspectionResult: InspectionResult
  returnedAt: string | null
  onConfirm: () => void
}

const AUTO_CONFIRM_SECONDS = 5

export function ReturnCompleteScreen({
  inspectionResult,
  returnedAt,
  onConfirm,
}: ReturnCompleteScreenProps) {
  const t = useTranslation()
  // PROJECT_GUIDE.md §6 "반납 결과 표현 규칙" — 확정 파손·비용 문구는 절대 노출하지 않는다.
  const resultMessage: Record<InspectionResult, string> = {
    [INSPECTION_RESULT.NORMAL]: t.return.resultNormal,
    [INSPECTION_RESULT.DAMAGED]: t.return.resultNeedsReview,
    [INSPECTION_RESULT.UNCERTAIN]: t.return.resultNeedsReview,
    [INSPECTION_RESULT.FAILED]: t.return.resultNeedsReview,
  }
  const needsReview = inspectionResult !== INSPECTION_RESULT.NORMAL
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
          <h2 className="text-3xl font-bold text-black">{t.return.completeTitle}</h2>
          <p
            className={
              needsReview
                ? 'text-error-text max-w-160 text-center text-xl font-semibold whitespace-pre-line'
                : 'text-tertiary-text max-w-100 text-center text-lg'
            }
          >
            {resultMessage[inspectionResult]}
          </p>

          <div className="border-disabled flex w-100 flex-col items-center gap-1 rounded-2xl border bg-white py-6">
            <span className="text-xl font-bold text-black">{t.return.returnedAtLabel}</span>
            <span className="text-tertiary-text text-lg">
              {returnedAt ? dayjs(returnedAt).format('YYYY-MM-DD') : t.common.notAvailable}
            </span>
            <span className="text-tertiary-text text-lg">
              {returnedAt ? dayjs(returnedAt).format('A h:mm') : t.common.checking}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="bg-primary flex h-18 w-18 items-center justify-center rounded-full">
            <span className="text-3xl font-bold text-white">{secondsLeft}</span>
          </div>
          <p className="text-tertiary-text text-base">
            {t.return.autoReturnHome}
          </p>

          <button
            type="button"
            onClick={onConfirm}
            className="bg-primary h-18 w-100 rounded-2xl text-2xl font-bold text-white transition-colors active:brightness-95"
          >
            {t.common.home}
          </button>
        </div>
      </div>
    </KioskLayout>
  )
}
