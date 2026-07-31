import { useEffect, useState } from 'react'
import { GuideContent } from '../../components/common/GuideContent'
import { ClockIcon } from '../../components/icons/ClockIcon'
import { EyeIcon } from '../../components/icons/EyeIcon'
import { UmbrellaIcon } from '../../components/icons/UmbrellaIcon'
import { KioskLayout } from '../../components/layout/KioskLayout'

interface UmbrellaGuideScreenProps {
  onAction: () => void
  onBack?: () => void
}

const UMBRELLA_GUIDE_STEPS = [
  { icon: UmbrellaIcon, text: '① 우산을 끝까지 펼쳐주세요.' },
  { icon: EyeIcon, text: '② 우산 전체가 화면 안에 들어오도록 맞춰주세요.' },
  { icon: ClockIcon, text: '③ 우산을 2~3초간 움직이지 말아주세요.' },
]

const AUTO_ADVANCE_SECONDS = 5

export function UmbrellaGuideScreen({
  onAction,
  onBack,
}: UmbrellaGuideScreenProps) {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_ADVANCE_SECONDS)

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (secondsLeft <= 0) onAction()
  }, [secondsLeft, onAction])

  return (
    <KioskLayout onBack={onBack} currentStep={3} flow="RETURN">
      <GuideContent
        title="우산을 펼쳐 카메라에 보여주세요"
        subtitle="정확한 파손 검사를 위해 아래 안내를 따라주세요."
        guideBox={
          <div className="border-disabled h-64 w-104 rounded-2xl border-2 border-dashed" />
        }
        steps={UMBRELLA_GUIDE_STEPS}
        actionLabel="준비되었습니다"
        onAction={onAction}
        footer={
          <div className="flex flex-col items-center gap-3">
            <div className="bg-primary flex h-18 w-18 items-center justify-center rounded-full">
              <span className="text-3xl font-bold text-white">
                {secondsLeft}
              </span>
            </div>
            <p className="text-tertiary-text text-base">
              5초 후 자동으로 우산 인식 화면으로 이동합니다
            </p>
          </div>
        }
      />
    </KioskLayout>
  )
}
