import { GuideContent } from '../../components/common/GuideContent'
import { EyeIcon } from '../../components/icons/EyeIcon'
import { UserIcon } from '../../components/icons/UserIcon'
import { KioskLayout } from '../../components/layout/KioskLayout'
import type { StepFlow } from '../../components/layout/StepIndicator'

interface FaceAuthGuideScreenProps {
  onAction: () => void
  onBack?: () => void
  flow?: StepFlow
}

const FACE_GUIDE_STEPS = [
  { icon: UserIcon, text: '① 얼굴이 가이드 라인 안에 들어오도록 맞춰주세요.' },
  { icon: EyeIcon, text: '② 정면을 응시해주세요.' },
]

export function FaceAuthGuideScreen({
  onAction,
  onBack,
  flow = 'RENT',
}: FaceAuthGuideScreenProps) {
  return (
    <KioskLayout onBack={onBack} currentStep={1} flow={flow}>
      <GuideContent
        title={
          flow === 'RETURN'
            ? '우산 반납을 위한 안면 인식을 시작합니다.'
            : '우산 대여를 위한 안면 인식을 시작합니다.'
        }
        subtitle="정확한 안면 인식을 위해 아래 안내를 따라주세요."
        guideBox={
          <div className="border-disabled h-56 w-104 rounded-2xl border-2 border-dashed" />
        }
        steps={FACE_GUIDE_STEPS}
        actionLabel="준비되었습니다"
        onAction={onAction}
      />
    </KioskLayout>
  )
}
