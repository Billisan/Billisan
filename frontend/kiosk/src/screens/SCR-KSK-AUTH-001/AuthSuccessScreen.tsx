import { useEffect, useState } from "react";
import checkAnimation from "../../assets/check.json?url";
import { Button } from "../../components/common/Button";
import { DotLottieAnimation } from "../../components/common/DotLottieAnimation";
import { KioskLayout } from "../../components/layout/KioskLayout";
import type { StepFlow } from "../../components/layout/StepIndicator";
import { useTranslation } from "../../i18n/useTranslation";

interface AuthSuccessScreenProps {
  flow?: StepFlow;
  displayName: string | null;
  onConfirm: () => void;
  onReject: () => void;
}

type SuccessPhase = "ICON_ONLY" | "TEXT_SHOWN" | "CONFIRM";

// PROVISIONAL_UI_VALUE(09-screen-flow.md DEC-SF-011류와 동일한 성격) — 문서에 명시된 값이
// 아닌 로컬 연출 타이밍. 정식 수치가 확정되면 갱신한다.
const TEXT_REVEAL_DELAY_MS = 1000;
const CONFIRM_REVEAL_DELAY_MS = 1000;

// AUTH_SUCCESS(faceAuthStore.ts 참고) — 얼굴 인증 성공 직후 체크 아이콘 → "인증되었습니다" →
// 실명 확인("OOO님이 맞으신가요?") 순서로 넘어가는 연출 화면.
// TEMP: 09-screen-flow.md §1은 얼굴 인증 중 이름 표시를 명시적으로 금지하지만, 팀 결정
// (2026-08-03)으로 이 실명 확인 단계를 추가하기로 했다 — 명세서는 아직 갱신 전이라 여기서는
// 그 결정을 우선 반영하고, displayName은 faceAuthStore를 통해 Mock 값만 채워진다.
export function AuthSuccessScreen({
  flow,
  displayName,
  onConfirm,
  onReject,
}: AuthSuccessScreenProps) {
  const t = useTranslation();
  const [phase, setPhase] = useState<SuccessPhase>("ICON_ONLY");

  useEffect(() => {
    const textTimer = window.setTimeout(
      () => setPhase("TEXT_SHOWN"),
      TEXT_REVEAL_DELAY_MS,
    );
    return () => window.clearTimeout(textTimer);
  }, []);

  useEffect(() => {
    if (phase !== "TEXT_SHOWN") return;
    const confirmTimer = window.setTimeout(
      () => setPhase("CONFIRM"),
      CONFIRM_REVEAL_DELAY_MS,
    );
    return () => window.clearTimeout(confirmTimer);
  }, [phase]);

  const isConfirmPhase = phase === "CONFIRM";

  return (
    <KioskLayout currentStep={2} flow={flow}>
      {/* justify-center로 실제 뷰포트 높이 기준 정중앙에서 시작하고, CONFIRM 단계에서만
          추가로 translateY만큼 위로 슬라이드한다 — 값 자체는 PROVISIONAL_UI_VALUE. */}
      <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center">
        <div
          className="flex flex-col items-center gap-6 transition-transform duration-700 ease-out"
          style={{
            transform: isConfirmPhase ? "translateY(-72px)" : "translateY(0)",
          }}
        >
          <DotLottieAnimation
            src={checkAnimation}
            width={200}
            height={200}
            loop={false}
          />
          {/* ICON_ONLY 단계부터 항상 마운트해 자리(높이)를 미리 예약해둔다 — 나중에 이 텍스트가
              새로 마운트되면서 justify-center 재중앙정렬이 아이콘을 순간 이동시켜, 아직 재생 중인
              check.json 그리기 애니메이션과 겹쳐 버벅여 보이는 문제가 있었다. opacity만 전환. */}
          {!isConfirmPhase && (
            <h2
              className={`text-3xl font-bold text-black transition-opacity duration-500 ${
                phase === "TEXT_SHOWN" ? "opacity-100" : "opacity-0"
              }`}
            >
              {t.auth.authSuccessText}
            </h2>
          )}
          {isConfirmPhase && (
            <div className="animate-rise-in flex w-102 flex-col items-center gap-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <h2 className="text-3xl font-bold text-black">
                  {t.auth.confirmQuestion(displayName)}
                </h2>
                <p className="text-tertiary-text text-xl">
                  {t.auth.confirmSubtitle}
                </p>
              </div>
              <div className="mt-10 flex w-full flex-col gap-6">
                <Button onClick={onConfirm} className="w-full">
                  {t.auth.confirmYes(flow ?? "RENT")}
                </Button>
                <Button variant="outline" onClick={onReject} className="w-full">
                  {t.auth.confirmNo}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </KioskLayout>
  );
}
