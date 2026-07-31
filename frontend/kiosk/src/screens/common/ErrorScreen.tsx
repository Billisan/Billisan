import aiScanFail from '../../assets/ai-scan-fail.svg'
import { Button } from '../../components/common/Button'
import { KioskLayout } from '../../components/layout/KioskLayout'
import type { StepFlow } from '../../components/layout/StepIndicator'

interface ErrorScreenProps {
  title: string
  subtitle?: string
  tips?: string[]
  actionLabel?: string
  onAction: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  currentStep?: 1 | 2 | 3 | 4
  flow?: StepFlow
}

export function ErrorScreen({
  title,
  subtitle,
  tips,
  actionLabel = '홈으로',
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  currentStep,
  flow,
}: ErrorScreenProps) {
  return (
    <KioskLayout currentStep={currentStep} flow={flow}>
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-10">
        <div className="flex w-full flex-col items-center gap-8">
          <img src={aiScanFail} alt="" className="h-40 w-40" />

          <div className="text-center">
            <h2 className="text-3xl font-bold text-black">{title}</h2>
            {subtitle && (
              <p className="text-tertiary-text mt-3 text-xl">{subtitle}</p>
            )}
          </div>

          {tips !== undefined && (
            <ul className="border-disabled flex w-104 flex-col gap-3 rounded-2xl border bg-white p-6">
              {tips.map((tip) => (
                <li
                  key={tip}
                  className="flex items-start gap-3 text-base text-black"
                >
                  <span className="bg-error-text mt-2 h-1.5 w-1.5 shrink-0 rounded-full" />
                  {tip}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex w-full flex-col items-center gap-4">
          <Button onClick={onAction} className="w-100">
            {actionLabel}
          </Button>
          {secondaryActionLabel && onSecondaryAction && (
            <Button
              variant="outline"
              onClick={onSecondaryAction}
              className="w-100"
            >
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      </div>
    </KioskLayout>
  )
}
