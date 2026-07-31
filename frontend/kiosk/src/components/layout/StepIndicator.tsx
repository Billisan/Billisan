export type StepFlow = 'RENT' | 'RETURN'

interface StepIndicatorProps {
  currentStep: number
  flow?: StepFlow
}

const STEP_LABELS: Record<StepFlow, string[]> = {
  RENT: ['대여 시작', '안면 인식', '우산 받기'],
  RETURN: ['반납 시작', '안면 인식', '우산 파손 인식', '반납 완료'],
}

export function StepIndicator({ currentStep, flow = 'RENT' }: StepIndicatorProps) {
  const steps = STEP_LABELS[flow].map((label, index) => ({
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
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'border-disabled text-tertiary-text border'
                }`}
              >
                {step}
              </span>
              <span
                className={`text-lg whitespace-nowrap ${
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
