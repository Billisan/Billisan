import type { ReactNode } from 'react'

type BadgeVariant = 'error'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
}

export function Badge({ children, variant = 'error' }: BadgeProps) {
  const variantClasses =
    variant === 'error' ? 'bg-error-bg text-error-text' : ''

  return (
    <span
      className={`rounded-full px-4 py-1 text-base font-semibold ${variantClasses}`}
    >
      {children}
    </span>
  )
}
