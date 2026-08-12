import { useEffect, useState } from 'react'
import umbrellaGuideImage from '../../assets/umbrella-guide.jpg'
import { GuideContent } from '../../components/common/GuideContent'
import { ClockIcon } from '../../components/icons/ClockIcon'
import { EyeIcon } from '../../components/icons/EyeIcon'
import { UmbrellaIcon } from '../../components/icons/UmbrellaIcon'
import { KioskLayout } from '../../components/layout/KioskLayout'
import { useTranslation } from '../../i18n/useTranslation'

interface UmbrellaGuideScreenProps {
  onAction: () => void
  onBack?: () => void
}

const AUTO_ADVANCE_SECONDS = 5

export function UmbrellaGuideScreen({
  onAction,
  onBack,
}: UmbrellaGuideScreenProps) {
  const t = useTranslation()
  const umbrellaGuideSteps = [
    { icon: UmbrellaIcon, text: t.return.guideSteps[0] },
    { icon: EyeIcon, text: t.return.guideSteps[1] },
    { icon: ClockIcon, text: t.return.guideSteps[2] },
  ]
  const [secondsLeft, setSecondsLeft] = useState(AUTO_ADVANCE_SECONDS)

  // 0에 도달하면 onAction만 호출하고 더 이상 타이머를 다시 걸지 않는다 — beginReturn이
  // 비동기 요청이라 화면이 바로 안 바뀌어도 이 화면에 머무는 동안 초가 음수로 내려가지 않게 함.
  useEffect(() => {
    if (secondsLeft <= 0) {
      onAction()
      return
    }

    const timer = window.setTimeout(() => setSecondsLeft((prev) => prev - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [secondsLeft, onAction])

  return (
    <KioskLayout onBack={onBack} currentStep={3} flow="RETURN">
      <GuideContent
        title={t.return.guideTitle}
        subtitle={t.return.guideSubtitle}
        guideBox={
          <div className="border-disabled h-64 w-104 overflow-hidden rounded-2xl border-2 border-dashed">
            <img
              src={umbrellaGuideImage}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        }
        steps={umbrellaGuideSteps}
        footer={
          <div className="flex flex-col items-center gap-3">
            <div className="bg-primary flex h-14 w-14 items-center justify-center rounded-full">
              <span className="text-2xl font-bold text-white">
                {secondsLeft}
              </span>
            </div>
            <p className="text-tertiary-text text-base">
              {t.return.autoAdvance}
            </p>
          </div>
        }
      />
    </KioskLayout>
  )
}
