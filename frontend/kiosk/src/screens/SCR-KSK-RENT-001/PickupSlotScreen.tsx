import { SlotActionCard } from '../../components/common/SlotActionCard'
import { KioskLayout } from '../../components/layout/KioskLayout'

interface PickupSlotScreenProps {
  slotNumber: number
  onAction: () => void
  onBack?: () => void
}

export function PickupSlotScreen({
  slotNumber,
  onAction,
  onBack,
}: PickupSlotScreenProps) {
  return (
    <KioskLayout onBack={onBack} currentStep={3}>
      <SlotActionCard
        slotNumber={slotNumber}
        label="우산함 번호"
        message={`${slotNumber}번 우산함에서 우산을 꺼내주세요`}
        actionLabel="꺼냈어요"
        type="rental"
        onAction={onAction}
      />
    </KioskLayout>
  )
}
