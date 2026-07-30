import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'outline'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: ButtonVariant
}

export function Button({
  children,
  disabled,
  variant = 'primary',
  className = '',
  ...rest
}: ButtonProps) {
  const variantClasses =
    variant === 'outline'
      ? 'border-disabled border-2 bg-white text-black'
      : disabled
        ? 'bg-disabled text-black/50 cursor-not-allowed'
        : 'bg-primary text-white active:brightness-95'

  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      className={`h-18 rounded-2xl text-2xl font-bold transition-colors ${variantClasses} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
