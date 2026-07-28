import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import { useEffect, useState, type ReactNode } from 'react'
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
    <div className="bg-kiosk-bg flex h-screen flex-col overflow-hidden">
      <header className="flex min-h-[18vh] w-full items-center justify-between px-14 py-6">
        <img src={logo} alt="Billisan" className="h-30" />
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
        <div className="flex min-h-[82vh] w-full flex-col items-center gap-20 overflow-hidden rounded-t-[120px] rounded-b-none bg-white p-20 shadow-[0_-8px_16px_rgba(120,120,120,0.12)]">
          {children}
        </div>
      </main>
    </div>
  )
}
