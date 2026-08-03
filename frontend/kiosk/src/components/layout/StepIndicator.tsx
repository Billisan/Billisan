import { useTranslation } from '../../i18n/useTranslation'

export type StepFlow = 'RENT' | 'RETURN'

interface StepIndicatorProps {
  currentStep: number
  flow?: StepFlow
}

export function StepIndicator({ currentStep, flow = 'RENT' }: StepIndicatorProps) {
  const t = useTranslation()
  const labels = flow === 'RETURN' ? t.stepIndicator.return : t.stepIndicator.rent
  const steps = labels.map((label, index) => ({
    step: index + 1,
    label,
  }))

  return (
    <div className="flex items-center">
      {steps.map(({ step, label }, index) => {
        const isActive = step === currentStep

        return (
          <div key={step} className="flex items-center">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-base font-bold ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'border-disabled text-tertiary-text border'
                }`}
              >
                {step}
              </span>
              <span
                className={`text-xl whitespace-nowrap ${
                  isActive
                    ? 'font-bold text-black'
                    : 'text-tertiary-text font-medium'
                }`}
              >
                {label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <span className="bg-disabled mx-4 h-px w-10" />
            )}
          </div>
        )
      })}
    </div>
  )
}
