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
      ? 'border-primary border-6 bg-white text-black'
      : disabled
        ? 'bg-disabled text-primary-text/50 cursor-not-allowed'
        : 'bg-primary text-white active:brightness-95'

  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      className={`min-h-100 rounded-2xl px-12 py-6 text-[43.2px] font-bold transition-colors ${variantClasses} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
