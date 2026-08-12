import checkAnimation from '../../assets/check.json?url'
import { DotLottieAnimation } from '../../components/common/DotLottieAnimation'
import { KioskLayout } from '../../components/layout/KioskLayout'
import { useTranslation } from '../../i18n/useTranslation'

// 우산 촬영(INSPECTION_CAPTURE)이 끝나고 AI 검수(INSPECTION_PROCESSING)로 넘어가는 시점에
// 잠깐 보여주는 순수 연출 화면. 전환 타이밍은 서버 이벤트 도착 여부와 함께 판단해야 하므로
// (ReturnFlow.tsx의 hold-and-apply 로직 참고) 이 컴포넌트는 내부 타이머를 갖지 않는다.
export function UmbrellaRecognizedScreen() {
  const t = useTranslation()

  return (
    <KioskLayout currentStep={3} flow="RETURN">
      <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-6">
        <DotLottieAnimation src={checkAnimation} width={200} height={200} loop={false} />
        <h2 className="text-3xl font-bold text-black">{t.return.umbrellaRecognized}</h2>
      </div>
    </KioskLayout>
  )
}
