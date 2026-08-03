import { useEffect, useState } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import type { RentalBlockReason } from '../../types/eligibility'
import { AlertCircleIcon } from '../icons/AlertCircleIcon'
import { IconBadge } from './IconBadge'

interface RentalBlockModalProps {
  reason: RentalBlockReason
  onClose: () => void
}

const AUTO_CLOSE_SECONDS = 5

export function RentalBlockModal({ reason, onClose }: RentalBlockModalProps) {
  const t = useTranslation()
  const { title, subtitle } = t.rentalBlock.reasons[reason]
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

        <div className="flex flex-col items-center gap-3">
          <div className="bg-primary flex h-18 w-18 items-center justify-center rounded-full">
            <span className="text-3xl font-bold text-white">{secondsLeft}</span>
          </div>
          <p className="text-tertiary-text text-base">
            {t.rentalBlock.autoClose}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="bg-primary h-18 w-100 rounded-2xl text-2xl font-bold text-white transition-colors active:brightness-95"
        >
          {t.rentalBlock.close}
        </button>
      </div>
    </div>
  )
}
