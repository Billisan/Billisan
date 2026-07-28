import { useEffect, useState, type ReactNode } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import logo from '../../assets/logo-umb.svg'

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
      <header className="flex w-full items-center justify-between px-12 py-8">
        <img src={logo} alt="Billisan" className="h-48 w-48" />
        <span className="text-navy/70 text-xl font-medium">
          {now.format('A h:mm')}
        </span>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-12 pb-16">
        <div className="flex w-full max-w-2xl flex-col items-center gap-8">
          {children}
        </div>
      </main>
    </div>
  )
}
