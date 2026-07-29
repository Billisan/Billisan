import { useEffect } from "react";
import { ActionCard } from "../../components/common/ActionCard";
import { InfoNoticeBar } from "../../components/common/InfoNoticeBar";
import { AlertCircleIcon } from "../../components/icons/AlertCircleIcon";
import { ClockIcon } from "../../components/icons/ClockIcon";
import { ReturnIcon } from "../../components/icons/ReturnIcon";
import { UmbrellaIcon } from "../../components/icons/UmbrellaIcon";
import { UserIcon } from "../../components/icons/UserIcon";
import { KioskLayout } from "../../components/layout/KioskLayout";
import {
  selectMainScreenVariant,
  useKioskMainStore,
} from "../../store/kioskMainStore";
import { MAIN_SCREEN_VARIANT } from "../../types/slot";
import { LoadingScreen } from "../common/LoadingScreen";

interface MainScreenProps {
  onRent?: () => void;
}

const INFO_NOTICE_ITEMS = [
  {
    icon: UserIcon,
    title: "학생 인증이 필요합니다",
    subtitle: "학생증 또는 얼굴 인증을 준비해주세요",
  },
  {
    icon: ClockIcon,
    title: "운영시간 09:00 - 21:00",
    subtitle: "문의 051-510-1234",
  },
  {
    icon: AlertCircleIcon,
    title: "우산을 소중히 사용해주세요",
    subtitle: "분실 및 파손 시 비용이 발생할 수 있습니다",
  },
];

export function MainScreen({ onRent }: MainScreenProps) {
  const usableSlotCount = useKioskMainStore((state) => state.usableSlotCount);
  const returnableSlotCount = useKioskMainStore(
    (state) => state.returnableSlotCount,
  );
  const isLoading = useKioskMainStore((state) => state.isLoading);
  const variant = useKioskMainStore(selectMainScreenVariant);
  const fetchStationSummary = useKioskMainStore(
    (state) => state.fetchStationSummary,
  );

  useEffect(() => {
    fetchStationSummary();
  }, [fetchStationSummary]);

  if (isLoading) {
    return <LoadingScreen message="재고를 확인하고 있어요" />;
  }

  const isRentDisabled = variant === MAIN_SCREEN_VARIANT.RENT_DISABLED_NO_STOCK;

  return (
    <KioskLayout fullBleed>
      <div className="flex w-full flex-1 flex-col gap-8 p-14">
        <div className="border-disabled divide-disabled flex w-full divide-x rounded-2xl border">
          <div className="flex flex-1 items-baseline justify-center gap-3 bg-white py-6">
            <span className="text-tertiary-text text-xl font-medium">
              현재 대여 가능한 우산
            </span>
            <span className="text-3xl font-bold text-black">
              {usableSlotCount ?? 0}개
            </span>
          </div>
          <div className="flex flex-1 items-baseline justify-center gap-3 bg-white py-6">
            <span className="text-tertiary-text text-xl font-medium">
              현재 반납 가능한 우산함
            </span>
            <span className="text-3xl font-bold text-black">
              {returnableSlotCount ?? 0}개
            </span>
          </div>
        </div>

        <div className="flex w-full flex-row gap-8">
          <ActionCard
            variant="primary"
            icon={UmbrellaIcon}
            title="대여"
            subtitle="학생 인증 후 우산을 대여합니다"
            disabled={isRentDisabled}
            onClick={onRent}
            className="flex-1"
          />
          <ActionCard
            variant="secondary"
            icon={ReturnIcon}
            title="반납"
            subtitle="대여한 우산을 반납합니다"
            className="flex-1"
          />
        </div>

        <InfoNoticeBar items={INFO_NOTICE_ITEMS} />
      </div>
    </KioskLayout>
  );
}
