interface FaceGuideOverlayProps {
  className?: string
  message?: string | null
}

export function FaceGuideOverlay({ className = '', message }: FaceGuideOverlayProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6 ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 200 260" className="h-11/12 w-auto" fill="none">
        <ellipse
          cx="100"
          cy="130"
          rx="90"
          ry="120"
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
