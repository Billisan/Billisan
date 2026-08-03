import { SlotActionCard } from '../../components/common/SlotActionCard'
import { KioskLayout } from '../../components/layout/KioskLayout'
import { useTranslation } from '../../i18n/useTranslation'

interface ReturnSlotScreenProps {
  slotNumber: number
  onBack?: () => void
}

export function ReturnSlotScreen({
  slotNumber,
  onBack,
}: ReturnSlotScreenProps) {
  const t = useTranslation()
  return (
    <KioskLayout onBack={onBack} currentStep={4} flow="RETURN">
      <SlotActionCard
        slotNumber={slotNumber}
        label={t.common.slotNumberLabel}
        message={t.return.dropoffMessage(slotNumber)}
        type="return"
      />
    </KioskLayout>
  )
}
