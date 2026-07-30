interface RentalStepIndicatorProps {
  currentStep: 1 | 2 | 3
}

const STEPS: Array<{ step: 1 | 2 | 3; label: string }> = [
  { step: 1, label: '대여 시작' },
  { step: 2, label: '안면 인식' },
  { step: 3, label: '우산 받기' },
]

export function RentalStepIndicator({ currentStep }: RentalStepIndicatorProps) {
  return (
    <div className="flex items-center">
      {STEPS.map(({ step, label }, index) => {
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
            {index < STEPS.length - 1 && (
              <span className="bg-disabled mx-4 h-px w-10" />
            )}
          </div>
        )
      })}
    </div>
  )
}
