import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import { useEffect, useState, type ReactNode } from 'react'
import logo from '../../assets/logo.svg'
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon'
import { StepIndicator, type StepFlow } from './StepIndicator'

dayjs.locale('ko')

interface KioskLayoutProps {
  children: ReactNode
  onBack?: () => void
  fullBleed?: boolean
  currentStep?: 1 | 2 | 3 | 4
  flow?: StepFlow
}

export function KioskLayout({
  children,
  onBack,
  fullBleed = false,
  currentStep,
  flow,
}: KioskLayoutProps) {
  const [now, setNow] = useState(() => dayjs())

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000 * 30)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex h-screen flex-col">
      <header className="relative flex min-h-[15vh] w-full items-center justify-between px-14 py-6">
        {currentStep && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <StepIndicator currentStep={currentStep} flow={flow} />
          </div>
        )}
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="bg-primary flex items-center gap-1 rounded-2xl px-6 py-3 text-2xl font-bold text-white transition-colors active:brightness-95"
          >
            <ChevronLeftIcon className="h-7 w-7" />
            이전
          </button>
        ) : (
          <img src={logo} alt="빌리산 로고" className="h-12" />
        )}
        <div className="flex flex-col items-end">
          <span className="text-tertiary-text text-xl font-medium">
            {now.format('YYYY년 M월 D일 dddd')}
          </span>
          <span className="text-3xl font-bold text-black">
            {now.format('A h:mm')}
          </span>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col items-center justify-end">
        <div
          className={`flex min-h-0 w-full flex-1 flex-col items-center overflow-hidden rounded-t-[60px] rounded-b-none bg-kiosk-bg shadow-[0_-4px_8px_rgba(120,120,120,0.12)] ${
            fullBleed ? '' : 'justify-between gap-14 p-10'
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  )
}
