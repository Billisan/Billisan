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
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-evenly">
      <div className="flex w-full flex-col items-center gap-12">
        <div className="w-full text-center">
          <h2 className="text-3xl font-bold text-black">{title}</h2>
          <p className="text-tertiary-text mt-2 text-lg">{subtitle}</p>
        </div>

        {guideBox}

        <div className="flex items-start justify-center gap-8">
          {steps.map(({ icon: Icon, text }) => (
            <div key={text} className="flex flex-col items-center gap-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#c2d9ff]">
                <Icon className="text-tertiary-text h-5 w-5" />
              </span>
              <p className="max-w-48 text-center text-base text-black">
                {text}
              </p>
            </div>
          ))}
        </div>

        {footer}
      </div>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="bg-primary h-18 w-100 m-4 rounded-2xl text-2xl font-bold text-white transition-colors active:brightness-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
