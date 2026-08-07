import { useEffect, useState } from "react";
import userIcon from "../../assets/ai-scan-user.svg";
import { KioskLayout } from "../../components/layout/KioskLayout";
import type { StepFlow } from "../../components/layout/StepIndicator";

interface LoadingScreenProps {
  title: string;
  subtitle: string;
  icon?: string;
  currentStep?: 1 | 2 | 3 | 4;
  flow?: StepFlow;
  // 진행률 계산 기준 시각(ms, Date.now() 값). 얼굴 인증 로딩 → 대여 슬롯 배정 로딩처럼 문구가
  // 이어지는 것처럼 보이는 두 화면 사이에 이 값을 그대로 넘기면, 컴포넌트가 다시 마운트돼도
  // 진행률이 0%로 리셋되지 않고 이어서 올라간다. 생략 시 이 컴포넌트의 마운트 시각을 기준으로 삼는다.
  startedAt?: number;
}

// 실제 진행률 신호는 없음(DEC-KSK-005 미정) — 로딩 체감 속도를 보여주기 위한 연출용 카운트업.
// 100%에서 멈추면 "다 됐는데 왜 안 넘어가지" 느낌을 주므로 99%에서 대기한다.
const PROGRESS_DURATION_MS = 1200;
const PROGRESS_TICK_MS = 50;
const MAX_DISPLAY_PROGRESS = 99;

export function LoadingScreen({
  title,
  subtitle,
  icon = userIcon,
  currentStep,
  flow,
  startedAt,
}: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const referenceTime = startedAt ?? Date.now();

    const tick = () => {
      const elapsed = Date.now() - referenceTime;
      const next = Math.round((elapsed / PROGRESS_DURATION_MS) * 100);
      setProgress(Math.min(Math.max(next, 0), MAX_DISPLAY_PROGRESS));
    };

    tick();
    const timer = setInterval(tick, PROGRESS_TICK_MS);

    return () => clearInterval(timer);
  }, [startedAt]);

  return (
    <KioskLayout currentStep={currentStep} flow={flow}>
      <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center gap-20">
        <div className="mt-8 flex flex-col items-center gap-4">
          <h2 className="text-4xl font-bold text-black">{title}</h2>
          <p className="text-tertiary-text text-xl">{subtitle}</p>
        </div>

        <div className="relative">
          <img src={icon} alt="" className="h-80 w-80" />
          <span className="bg-primary absolute -bottom-12 left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full px-5 py-2 text-lg font-bold text-white shadow-sm">
            {progress}%
          </span>
        </div>
      </div>
    </KioskLayout>
  );
}
