import { useEffect } from "react";
import { ActionCard } from "../../components/common/ActionCard";
import { InfoNoticeBar } from "../../components/common/InfoNoticeBar";
import { RentalBlockModal } from "../../components/common/RentalBlockModal";
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

interface MainScreenProps {
  onRent?: () => void;
  onReturn?: () => void;
}

const INFO_NOTICE_ITEMS = [
  {
    icon: UserIcon,
    title: "학생 인증이 필요합니다",
    subtitle: "간편한 얼굴 인증으로 바로 이용할 수 있습니다",
  },
  {
    icon: ClockIcon,
    title: "24시간 운영",
    subtitle: "빌리산 앱을 통해 추가 문의가 가능합니다",
  },
  {
    icon: AlertCircleIcon,
    title: "우산을 소중히 사용해주세요",
    subtitle: "분실 및 파손 시 비용이 발생할 수 있습니다",
  },
];

export function MainScreen({ onRent, onReturn }: MainScreenProps) {
  const usableSlotCount = useKioskMainStore((state) => state.usableSlotCount);
  const returnableSlotCount = useKioskMainStore(
    (state) => state.returnableSlotCount,
  );
  const variant = useKioskMainStore(selectMainScreenVariant);
  const fetchStationSummary = useKioskMainStore(
    (state) => state.fetchStationSummary,
  );
  const rentalBlockReason = useKioskMainStore(
    (state) => state.rentalBlockReason,
  );
  const clearRentalBlockReason = useKioskMainStore(
    (state) => state.clearRentalBlockReason,
  );

  useEffect(() => {
    fetchStationSummary();
  }, [fetchStationSummary]);

  const isRentDisabled = variant === MAIN_SCREEN_VARIANT.RENT_DISABLED_NO_STOCK;

  return (
    <KioskLayout fullBleed>
      <div className="flex w-full flex-1 flex-col justify-between p-14">
        <div className="flex w-full flex-col gap-4">
          <div className="border-disabled divide-disabled bg-white flex w-full divide-x rounded-2xl border">
            <div className="flex flex-1 items-baseline justify-center gap-3 py-4">
              <span className="text-tertiary-text text-xl font-medium">
                현재 대여 가능한 우산
              </span>
              <span className="text-3xl font-bold text-black">
                {usableSlotCount ?? 0}개
              </span>
            </div>
            <div className="flex flex-1 items-baseline justify-center gap-3  py-4">
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
              onClick={onReturn}
              className="flex-1"
            />
          </div>
        </div>

        <InfoNoticeBar items={INFO_NOTICE_ITEMS} />
      </div>

      {rentalBlockReason && (
        <RentalBlockModal
          reason={rentalBlockReason}
          onClose={clearRentalBlockReason}
        />
      )}
    </KioskLayout>
  );
}
