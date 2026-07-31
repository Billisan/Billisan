import { SlotActionCard } from '../../components/common/SlotActionCard'
import { KioskLayout } from '../../components/layout/KioskLayout'

interface ReturnSlotScreenProps {
  slotNumber: number
  onBack?: () => void
}

export function ReturnSlotScreen({
  slotNumber,
  onBack,
}: ReturnSlotScreenProps) {
  return (
    <KioskLayout onBack={onBack} currentStep={4} flow="RETURN">
      <SlotActionCard
        slotNumber={slotNumber}
        label="우산함 번호"
        message={`${slotNumber}번 우산함에 우산을 넣어주세요`}
        type="return"
      />
    </KioskLayout>
  )
}
