import type { ButtonHTMLAttributes, ComponentType, SVGProps } from 'react'
import { ArrowRightIcon } from '../icons/ArrowRightIcon'

type ActionCardVariant = 'primary' | 'secondary'

interface ActionCardProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  variant?: ActionCardVariant
  icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  subtitle: string
  disabled?: boolean
}

export function ActionCard({
  variant = 'secondary',
  icon: Icon,
  title,
  subtitle,
  disabled,
  className = '',
  ...rest
}: ActionCardProps) {
  const isPrimary = variant === 'primary' && !disabled

  const containerClasses = isPrimary
    ? 'bg-primary text-white'
    : 'bg-white text-black border-2 border-disabled'

  const iconCircleClasses = isPrimary
    ? 'bg-white text-primary'
    : 'bg-kiosk-bg text-tertiary-text'

  const arrowCircleClasses = isPrimary
    ? 'bg-white/30 text-white'
    : 'bg-kiosk-bg text-tertiary-text'

  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      className={`relative flex min-h-74 w-full items-center gap-6 overflow-hidden rounded-3xl px-10 py-8 text-left transition-colors ${containerClasses} ${disabled ? 'cursor-not-allowed opacity-60' : 'active:brightness-95'} ${className}`}
      {...rest}
    >
      <Icon
        className={`pointer-events-none absolute -right-6 top-1/2 h-44 w-44 -translate-y-1/2 opacity-15 ${isPrimary ? 'text-white' : 'text-tertiary-text'}`}
      />

      <span
        className={`relative z-10 flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full ${iconCircleClasses}`}
      >
        <Icon className="h-14 w-14" />
      </span>

      <span className="relative z-10 flex flex-1 flex-col gap-1">
        <span className="text-4xl font-bold">{title}</span>
        <span
          className={`text-lg ${isPrimary ? 'text-white/90' : 'text-tertiary-text'}`}
        >
          {subtitle}
        </span>
      </span>

      <span
        className={`absolute right-6 bottom-6 z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${arrowCircleClasses}`}
      >
        <ArrowRightIcon className="h-6 w-6" />
      </span>
    </button>
  )
}
