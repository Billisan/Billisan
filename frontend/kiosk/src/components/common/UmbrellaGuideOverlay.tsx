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
      {message && (
        <p className="absolute bottom-16 rounded-full bg-black/60 px-6 py-3 text-xl font-bold text-white">
          {message}
        </p>
      )}
    </div>
  )
}
