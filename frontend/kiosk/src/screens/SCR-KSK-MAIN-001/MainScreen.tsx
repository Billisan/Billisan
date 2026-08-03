import { useEffect } from "react";
import reloadAnimation from "../../assets/reload.json?url";
import weatherAnimation from "../../assets/weather.json?url";
import { useTranslation } from "../../i18n/useTranslation";
import { ActionCard } from "../../components/common/ActionCard";
import { DotLottieAnimation } from "../../components/common/DotLottieAnimation";
import { RentalBlockModal } from "../../components/common/RentalBlockModal";
import { ReturnIcon } from "../../components/icons/ReturnIcon";
import { ReturnIllustrationIcon } from "../../components/icons/ReturnIllustrationIcon";
import { TouchIcon } from "../../components/icons/TouchIcon";
import { UmbrellaIcon } from "../../components/icons/UmbrellaIcon";
import { UmbrellaIllustrationIcon } from "../../components/icons/UmbrellaIllustrationIcon";
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

export function MainScreen({ onRent, onReturn }: MainScreenProps) {
  const t = useTranslation();
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
      <div className="flex w-full flex-1 flex-col justify-center px-4">
        <div className="flex w-full flex-col gap-12">
          <div className="mx-auto flex w-9/10 flex-row gap-10">
            <ActionCard
              variant="primary"
              icon={UmbrellaIcon}
              decorativeIcon={UmbrellaIllustrationIcon}
              badgeIcon={
                <DotLottieAnimation
                  src={weatherAnimation}
                  width={54}
                  height={54}
                />
              }
              title={t.main.rentTitle}
              subtitle={t.main.rentSubtitle}
              disabled={isRentDisabled}
              onClick={onRent}
              className="flex-1"
            />
            <ActionCard
              variant="secondary"
              icon={ReturnIcon}
              decorativeIcon={ReturnIllustrationIcon}
              badgeIcon={
                <DotLottieAnimation
                  src={reloadAnimation}
                  width={46}
                  height={46}
                  speed={1.4}
                />
              }
              title={t.main.returnTitle}
              subtitle={t.main.returnSubtitle}
              onClick={onReturn}
              className="flex-1"
            />
          </div>

          <div className="border-disabled mx-auto mb-10 flex w-1/3 items-center justify-center gap-3 rounded-full border-2 border-dashed py-5">
            <div className="animate-gentle-pulse flex items-center gap-3">
              <TouchIcon className="text-tertiary-text h-9 w-9" />
              <span className="text-tertiary-text text-xl font-medium">
                {t.main.touchHint}
              </span>
            </div>
          </div>
        </div>
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
