import { useEffect, useState } from 'react'
import {
  RENTAL_BLOCK_REASON,
  type RentalBlockReason,
} from '../../types/eligibility'
import { AlertCircleIcon } from '../icons/AlertCircleIcon'
import { IconBadge } from './IconBadge'

interface RentalBlockModalProps {
  reason: RentalBlockReason
  onClose: () => void
}

const MESSAGES: Record<
  RentalBlockReason,
  { title: string; subtitle: string }
> = {
  [RENTAL_BLOCK_REASON.UNSETTLED_BLOCKED]: {
    title: '미정산 내역이 있어요',
    subtitle: '앱에서 정산 후 다시 이용해주세요.',
  },
  [RENTAL_BLOCK_REASON.ACTIVE_RENTAL_EXISTS]: {
    title: '이미 대여 중인 우산이 있어요',
    subtitle: '현재 대여 중인 건이 있어 신규 대여할 수 없습니다.',
  },
}

const AUTO_CLOSE_SECONDS = 5

export function RentalBlockModal({ reason, onClose }: RentalBlockModalProps) {
  const { title, subtitle } = MESSAGES[reason]
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CLOSE_SECONDS)

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (secondsLeft <= 0) onClose()
  }, [secondsLeft, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="flex w-5xl min-h-128 flex-col items-center justify-center gap-8 rounded-3xl bg-white p-12 text-center">
        <IconBadge variant="error">
          <AlertCircleIcon className="h-12 w-12" />
        </IconBadge>
        <div>
          <h3 className="text-3xl font-bold text-black">{title}</h3>
          <p className="text-tertiary-text mt-3 text-xl">{subtitle}</p>
        </div>

        <p className="text-tertiary-text text-base">
          {secondsLeft}초 후 자동으로 닫힙니다
        </p>

        <button
          type="button"
          onClick={onClose}
          className="bg-primary h-18 w-100 rounded-2xl text-2xl font-bold text-white transition-colors active:brightness-95"
        >
          닫기
        </button>
      </div>
    </div>
  )
}
