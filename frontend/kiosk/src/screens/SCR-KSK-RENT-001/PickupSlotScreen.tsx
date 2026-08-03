import { SlotActionCard } from '../../components/common/SlotActionCard'
import { KioskLayout } from '../../components/layout/KioskLayout'
import { useTranslation } from '../../i18n/useTranslation'

interface PickupSlotScreenProps {
  slotNumber: number
  onBack?: () => void
}

export function PickupSlotScreen({
  slotNumber,
  onBack,
}: PickupSlotScreenProps) {
  const t = useTranslation()
  return (
    <KioskLayout onBack={onBack} currentStep={3}>
      <SlotActionCard
        slotNumber={slotNumber}
        label={t.common.slotNumberLabel}
        message={t.rent.pickupMessage(slotNumber)}
        type="rental"
      />
    </KioskLayout>
  )
}
