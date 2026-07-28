import { useEffect, useState, type ReactNode } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import logo from '../../assets/logo/logo-umbrella.svg'

dayjs.locale('ko')

interface KioskLayoutProps {
  children: ReactNode
}

export function KioskLayout({ children }: KioskLayoutProps) {
  const [now, setNow] = useState(() => dayjs())

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000 * 30)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="bg-kiosk-bg flex min-h-screen flex-col">
      <header className="flex w-full items-center justify-between px-14 py-4">
        <img src={logo} alt="Billisan" className="h-48 w-48" />
        <div className="flex flex-col items-end">
          <span className="text-tertiary-text text-xl font-medium">
            {now.format('YYYY년 M월 D일 dddd')}
          </span>
          <span className="text-primary-text/70 text-3xl font-bold">
            {now.format('A h:mm')}
          </span>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-end gap-8">
        <div className="flex w-full flex-col items-center gap-24 rounded-t-[120px] rounded-b-none bg-white p-24 shadow-[0_-8px_16px_rgba(120,120,120,0.12)]">
          {children}
        </div>
      </main>
    </div>
  )
}
