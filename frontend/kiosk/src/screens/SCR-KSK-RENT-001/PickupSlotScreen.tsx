import { SlotActionCard } from '../../components/common/SlotActionCard'
import { KioskLayout } from '../../components/layout/KioskLayout'

interface PickupSlotScreenProps {
  slotNumber: number
  onBack?: () => void
}

export function PickupSlotScreen({
  slotNumber,
  onBack,
}: PickupSlotScreenProps) {
  return (
    <KioskLayout onBack={onBack} currentStep={3}>
      <SlotActionCard
        slotNumber={slotNumber}
        label="우산함 번호"
        message={`${slotNumber}번 우산함에서 우산을 꺼내주세요`}
        type="rental"
      />
    </KioskLayout>
  )
}
