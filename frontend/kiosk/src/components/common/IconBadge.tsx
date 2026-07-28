import type { ReactNode } from 'react'

type IconBadgeVariant = 'error' | 'success'

interface IconBadgeProps {
  children: ReactNode
  variant: IconBadgeVariant
}

export function IconBadge({ children, variant }: IconBadgeProps) {
  const variantClasses =
    variant === 'error' ? 'bg-error-bg text-error-text' : 'bg-primary/20 text-black'

  return (
    <div
      className={`flex h-20 w-20 items-center justify-center rounded-full ${variantClasses}`}
    >
      {children}
    </div>
  )
}
