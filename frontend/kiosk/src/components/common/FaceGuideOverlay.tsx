interface FaceGuideOverlayProps {
  className?: string
}

export function FaceGuideOverlay({ className = '' }: FaceGuideOverlayProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 200 260" className="h-2/3 w-auto" fill="none">
        <ellipse
          cx="100"
          cy="130"
          rx="90"
          ry="120"
          stroke="white"
          strokeWidth="4"
          strokeDasharray="12 10"
        />
      </svg>
    </div>
  )
}
