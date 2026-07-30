interface UmbrellaGuideOverlayProps {
  className?: string
  message?: string | null
}

export function UmbrellaGuideOverlay({
  className = '',
  message,
}: UmbrellaGuideOverlayProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6 ${className}`}
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

      {message && (
        <p className="absolute bottom-16 rounded-full bg-black/60 px-6 py-3 text-xl font-bold text-white">
          {message}
        </p>
      )}
    </div>
  )
}
