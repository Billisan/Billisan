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
}: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const next = Math.round((elapsed / PROGRESS_DURATION_MS) * 100);
      setProgress(Math.min(next, MAX_DISPLAY_PROGRESS));
    }, PROGRESS_TICK_MS);

    return () => clearInterval(timer);
  }, []);

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
