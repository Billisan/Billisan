import { useState } from 'react'
import type { RentalStart } from '../../api/rentalApi'
import { PickupSlotScreen } from './PickupSlotScreen'
import { RentalCompleteScreen } from './RentalCompleteScreen'

interface RentFlowProps {
  rental: RentalStart
  onBack: () => void
}

export function RentFlow({ rental, onBack }: RentFlowProps) {
  const [isPickedUp, setIsPickedUp] = useState(false)

  if (!isPickedUp) {
    return (
      <PickupSlotScreen
        slotNumber={rental.slotNumber}
        onBack={onBack}
        onAction={() => setIsPickedUp(true)}
      />
    )
  }

  return (
    <RentalCompleteScreen
      rentedAt={rental.rentedAt}
      dueAt={rental.dueAt}
      onConfirm={onBack}
    />
  )
}
