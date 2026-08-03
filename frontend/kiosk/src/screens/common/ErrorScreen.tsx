import errorAnimation from '../../assets/error.json?url'
import { Button } from '../../components/common/Button'
import { DotLottieAnimation } from '../../components/common/DotLottieAnimation'
import { KioskLayout } from '../../components/layout/KioskLayout'
import type { StepFlow } from '../../components/layout/StepIndicator'
import { useTranslation } from '../../i18n/useTranslation'

interface ErrorScreenProps {
  title: string
  subtitle?: string
  tips?: readonly string[]
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
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  currentStep,
  flow,
}: ErrorScreenProps) {
  const t = useTranslation()
  return (
    <KioskLayout currentStep={currentStep} flow={flow}>
      <div className="flex w-full flex-1 flex-col items-center gap-20">
        <div className="flex w-full flex-col items-center gap-10">
          <DotLottieAnimation
            src={errorAnimation}
            width={160}
            height={160}
            speed={0.7}
          />

          <div className="text-center">
            <h2 className="text-3xl font-bold text-black">{title}</h2>
            {subtitle && (
              <p className="text-tertiary-text mt-3 text-xl">{subtitle}</p>
            )}
          </div>

          {tips !== undefined && (
            <ul className="border-disabled flex w-108 flex-col gap-3 rounded-2xl border bg-white p-6">
              {tips.map((tip) => (
                <li
                  key={tip}
                  className="flex items-start gap-3 text-lg text-black"
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
            {actionLabel ?? t.common.home}
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
