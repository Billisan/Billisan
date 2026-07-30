import { GuideContent } from '../../components/common/GuideContent'
import { EyeIcon } from '../../components/icons/EyeIcon'
import { UserIcon } from '../../components/icons/UserIcon'
import { KioskLayout } from '../../components/layout/KioskLayout'

interface FaceAuthGuideScreenProps {
  onAction: () => void
  onBack?: () => void
}

const FACE_GUIDE_STEPS = [
  { icon: UserIcon, text: '① 얼굴이 가이드 라인 안에 들어오도록 맞춰주세요.' },
  { icon: EyeIcon, text: '② 정면을 응시해주세요.' },
]

export function FaceAuthGuideScreen({
  onAction,
  onBack,
}: FaceAuthGuideScreenProps) {
  return (
    <KioskLayout onBack={onBack} currentStep={1}>
      <GuideContent
        title="우산 대여를 위한 안면 인식을 시작합니다."
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
