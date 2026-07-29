import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import { useEffect, useState, type ReactNode } from 'react'
import logo from '../../assets/logo.svg'
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon'

dayjs.locale('ko')

interface KioskLayoutProps {
  children: ReactNode
  onBack?: () => void
  fullBleed?: boolean
}

export function KioskLayout({
  children,
  onBack,
  fullBleed = false,
}: KioskLayoutProps) {
  const [now, setNow] = useState(() => dayjs())

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000 * 30)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex h-screen flex-col">
      <header className="flex min-h-[20vh] w-full items-center justify-between px-14 py-6">
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
          <img src={logo} alt="빌리산 로고" className="h-14" />
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
          className={`flex min-h-0 w-full flex-1 flex-col items-center rounded-t-[60px] rounded-b-none bg-kiosk-bg shadow-[0_-8px_16px_rgba(120,120,120,0.12)] ${
            fullBleed ? '' : 'justify-center gap-14 p-20'
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  )
}
