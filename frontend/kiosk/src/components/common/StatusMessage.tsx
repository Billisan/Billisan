import type { ReactNode } from 'react'

interface StatusMessageProps {
  children: ReactNode
}

export function StatusMessage({ children }: StatusMessageProps) {
  return <p className="text-2xl font-medium text-black">{children}</p>
}
