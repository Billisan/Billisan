interface UmbrellaGuideOverlayProps {
  className?: string
}

export function UmbrellaGuideOverlay({
  className = '',
}: UmbrellaGuideOverlayProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 260 200" className="h-5/6 w-11/12" fill="none">
        <rect
          x="10"
          y="10"
          width="240"
          height="180"
          rx="16"
          stroke="white"
          strokeWidth="3"
          strokeDasharray="12 10"
        />
      </svg>
    </div>
  )
}
