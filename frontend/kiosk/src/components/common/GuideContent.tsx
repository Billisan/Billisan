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
  actionLabel: string
  onAction: () => void
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
    <div className="flex w-full flex-col items-center gap-14">
      <div className="flex w-full flex-col items-center gap-10">
        <div className="w-full text-center">
          <h2 className="text-3xl font-bold text-black">{title}</h2>
          <p className="text-tertiary-text mt-2 text-lg">{subtitle}</p>
        </div>

        {guideBox}

        <div className="flex items-start justify-center gap-16">
          {steps.map(({ icon: Icon, text }) => (
            <div key={text} className="flex flex-col items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c2d9ff]">
                <Icon className="text-tertiary-text h-4 w-4" />
              </span>
              <p className="max-w-52 text-center text-base text-black">
                {text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {footer}

      <button
        type="button"
        onClick={onAction}
        className="bg-primary h-18 w-100 rounded-2xl text-2xl font-bold text-white transition-colors active:brightness-95"
      >
        {actionLabel}
      </button>
    </div>
  )
}
