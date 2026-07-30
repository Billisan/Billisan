import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import checkCircleIcon from '../../assets/check-circle.svg'
import { KioskLayout } from '../../components/layout/KioskLayout'

interface RentalCompleteScreenProps {
  rentedAt: string
  dueAt: string
  onConfirm: () => void
}

const AUTO_CONFIRM_SECONDS = 5

export function RentalCompleteScreen({
  rentedAt,
  dueAt,
  onConfirm,
}: RentalCompleteScreenProps) {
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
    <KioskLayout currentStep={3}>
      <div className="flex w-full flex-col items-center gap-14">
        <div className="flex flex-col items-center gap-6">
          <img src={checkCircleIcon} alt="" className="h-40 w-40" />
          <h2 className="text-3xl font-bold text-black">대여 완료!</h2>

          <div className="border-disabled divide-disabled flex w-100 divide-x rounded-2xl border bg-white">
            <div className="flex flex-1 flex-col items-center gap-1 py-6">
              <span className="text-lg font-bold text-black">대여 시각</span>
              <span className="text-tertiary-text text-base">
                {dayjs(rentedAt).format('YYYY-MM-DD')}
              </span>
              <span className="text-tertiary-text text-base">
                {dayjs(rentedAt).format('A h:mm')}
              </span>
            </div>
            <div className="flex flex-1 flex-col items-center gap-1 py-6">
              <span className="text-lg font-bold text-black">반납 기한</span>
              <span className="text-tertiary-text text-base">
                {dayjs(dueAt).format('YYYY-MM-DD')}
              </span>
              <span className="text-tertiary-text text-base">
                {dayjs(dueAt).format('A h:mm')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-tertiary-text text-base">
            {secondsLeft}초 후 자동으로 홈 화면으로 돌아갑니다
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
