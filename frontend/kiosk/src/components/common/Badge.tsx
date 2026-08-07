interface BadgeProps {
  children: string
  className?: string
}

export function Badge({ children, className = '' }: BadgeProps) {
  return (
    <span
      className={`bg-error-bg text-error-text inline-block rounded-full px-6 py-2.5 text-lg font-semibold ${className}`}
    >
      {children}
    </span>
  )
}
