import type { ComponentType, ReactNode, SVGProps } from 'react'

interface GuideStep {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  text: string
}

interface GuideContentProps {
  title: string
  subtitle: string
  guideBox: ReactNode
  steps: GuideStep[]
  actionLabel?: string
  onAction?: () => void
  footer?: ReactNode
}

export function GuideContent({
  title,
  subtitle,
  guideBox,
  steps,
  actionLabel,
  onAction,
  footer,
}: GuideContentProps) {
  return (
    <div className="flex h-full w-2/3 flex-1 flex-col items-center justify-evenly">
      <div className="text-center">
        <h2 className="mb-2 text-3xl font-bold text-black">{title}</h2>
        <p className="text-tertiary-text text-xl">{subtitle}</p>
      </div>
      <div className="flex w-full items-center justify-center gap-4">
        <div className="flex flex-1 flex-col items-center">{guideBox}</div>

        <div className="flex flex-1 flex-col justify-evenly gap-10">
          {steps.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#c2d9ff]">
                <Icon className="text-tertiary-text h-5 w-5" />
              </span>
              <p className="text-lg text-black">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {footer}

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="bg-primary h-18 w-106 rounded-2xl text-2xl font-bold text-white transition-colors active:brightness-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
