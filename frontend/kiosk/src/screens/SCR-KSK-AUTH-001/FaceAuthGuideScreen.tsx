import { GuideContent } from '../../components/common/GuideContent'
import { EyeIcon } from '../../components/icons/EyeIcon'
import { UserIcon } from '../../components/icons/UserIcon'
import { KioskLayout } from '../../components/layout/KioskLayout'
import type { StepFlow } from '../../components/layout/StepIndicator'
import { useTranslation } from '../../i18n/useTranslation'

interface FaceAuthGuideScreenProps {
  onAction: () => void
  onBack?: () => void
  flow?: StepFlow
}

export function FaceAuthGuideScreen({
  onAction,
  onBack,
  flow = 'RENT',
}: FaceAuthGuideScreenProps) {
  const t = useTranslation()
  const faceGuideSteps = [
    { icon: UserIcon, text: t.auth.guideStep1 },
    { icon: EyeIcon, text: t.auth.guideStep2 },
  ]

  return (
    <KioskLayout onBack={onBack} currentStep={1} flow={flow}>
      <GuideContent
        title={flow === 'RETURN' ? t.auth.guideTitleReturn : t.auth.guideTitleRent}
        subtitle={t.auth.guideSubtitle}
        guideBox={
          <div className="border-disabled h-56 w-104 rounded-2xl border-2 border-dashed" />
        }
        steps={faceGuideSteps}
        actionLabel={t.auth.readyButton}
        onAction={onAction}
      />
    </KioskLayout>
  )
}
