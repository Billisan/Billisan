import type { ReactNode } from 'react'

type IconBadgeVariant = 'error' | 'success' | 'neutral'

interface IconBadgeProps {
  children: ReactNode
  variant?: IconBadgeVariant
}

export function IconBadge({ children, variant = 'neutral' }: IconBadgeProps) {
  const variantClasses =
    variant === 'error'
      ? 'bg-error-bg text-error-text'
      : variant === 'success'
        ? 'bg-primary/20 text-black'
        : 'bg-kiosk-bg text-black'

  return (
    <div
      className={`flex h-20 w-20 items-center justify-center rounded-full ${variantClasses}`}
    >
      {children}
    </div>
  )
}
