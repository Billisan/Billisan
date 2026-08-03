import dayjs from "dayjs";
import { useEffect, useState, type ReactNode } from "react";
import logo from "../../assets/logo.svg";
import { useTranslation } from "../../i18n/useTranslation";
import { useLanguageStore } from "../../store/languageStore";
import { LanguageToggle } from "../common/LanguageToggle";
import { ChevronLeftIcon } from "../icons/ChevronLeftIcon";
import { LocationIcon } from "../icons/LocationIcon";
import { StepIndicator, type StepFlow } from "./StepIndicator";

interface KioskLayoutProps {
  children: ReactNode;
  onBack?: () => void;
  fullBleed?: boolean;
  currentStep?: 1 | 2 | 3 | 4;
  flow?: StepFlow;
}

export function KioskLayout({
  children,
  onBack,
  fullBleed = false,
  currentStep,
  flow,
}: KioskLayoutProps) {
  const t = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const [now, setNow] = useState(() => dayjs());

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000 * 30);
    return () => clearInterval(timer);
  }, []);

  // now는 최대 30초 전에 생성된 인스턴스라 언어를 방금 바꿨어도 아직 이전 locale을
  // 들고 있을 수 있다. .locale(language)로 렌더 시점에 명시적으로 다시 적용해
  // (인스턴스를 mutate하지 않고 clone) 언어 전환이 다음 30초를 기다리지 않고 바로 반영되게 한다.
  const localizedNow = now.locale(language);

  return (
    <div className="relative flex h-screen flex-col bg-linear-to-b from-white via-white via-60% to-[#FFFAE1]">
      <header className="relative flex min-h-[15vh] w-full items-center justify-between p-14">
        {currentStep && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <StepIndicator currentStep={currentStep} flow={flow} />
          </div>
        )}
        {!currentStep ? (
          <div className="flex items-center gap-6">
            <img src={logo} alt="빌리산 로고" className="h-16" />
            <div className="text-tertiary-text flex items-center gap-2">
              <LocationIcon className="text-primary h-10 w-10 shrink-0" />
              <div className="flex flex-col leading-tight">
                <span className="text-2xl font-semibold text-black">
                  {t.header.schoolName}
                </span>
                <span className="text-lg font-medium">{t.header.location}</span>
              </div>
            </div>
          </div>
        ) : (
          onBack && (
            <button
              type="button"
              onClick={onBack}
              className="bg-primary flex items-center gap-1 rounded-2xl px-6 py-3 text-2xl font-bold text-white transition-colors active:brightness-95"
            >
              <ChevronLeftIcon className="h-7 w-7" />
              {t.common.back}
            </button>
          )
        )}
        {!currentStep && <LanguageToggle />}
      </header>
      <main className="flex min-h-0 flex-1 flex-col items-center justify-end">
        <div
          className={`flex min-h-0 w-full flex-1 flex-col items-center overflow-hidden ${
            fullBleed ? "" : "gap-12 p-14"
          }`}
        >
          {children}
        </div>
      </main>
      {!currentStep && (
        <div className="pointer-events-none absolute right-14 bottom-6 flex flex-col items-end pb-6">
          <span className="text-tertiary-text text-xl font-medium">
            {localizedNow.format("YYYY.MM.DD dd")}
          </span>
          <span className="text-3xl font-bold text-tertiary-text">
            {localizedNow.format("A h:mm")}
          </span>
        </div>
      )}
    </div>
  );
}
