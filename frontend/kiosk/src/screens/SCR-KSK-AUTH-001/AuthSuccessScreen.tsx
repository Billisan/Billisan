import checkAnimation from '../../assets/Tick Market.json?url'
import { DotLottieAnimation } from '../../components/common/DotLottieAnimation'
import { KioskLayout } from '../../components/layout/KioskLayout'
import type { StepFlow } from '../../components/layout/StepIndicator'

interface AuthSuccessScreenProps {
  flow?: StepFlow
}

// AUTH_SUCCESS(faceAuthStore.ts 참고) — 얼굴 인증 성공 직후, "환영합니다!" 로딩 화면으로
// 넘어가기 전에 잠깐 보여주는 체크 아이콘 연출 화면.
export function AuthSuccessScreen({ flow }: AuthSuccessScreenProps) {
  return (
    <KioskLayout currentStep={2} flow={flow}>
      <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-8">
        <DotLottieAnimation
          src={checkAnimation}
          width={200}
          height={200}
          loop={false}
        />
        <h2 className="text-3xl font-bold text-black">인증되었습니다</h2>
      </div>
    </KioskLayout>
  )
}
