import UmbrellaSlotAnimationIcon from '../icons/UmbrellaSlotAnimationIcon'

interface SlotActionCardProps {
  slotNumber: number
  label: string
  message: string
  actionLabel: string
  type: 'rental' | 'return'
  onAction: () => void
}

export function SlotActionCard({
  slotNumber,
  label,
  message,
  actionLabel,
  type,
  onAction,
}: SlotActionCardProps) {
  return (
    <div className="flex w-full flex-col items-center gap-14">
      <div className="flex flex-col items-center gap-10">
        <UmbrellaSlotAnimationIcon direction={type} speed={3} />

        <div className="flex flex-col items-center gap-2">
          <p className="text-tertiary-text text-lg">{label}</p>
          <p className="text-8xl font-bold text-black">
            {String(slotNumber).padStart(2, '0')}
          </p>
        </div>

        <p className="text-xl font-medium text-black">{message}</p>
      </div>

      <button
        type="button"
        onClick={onAction}
        className="bg-primary h-18 w-100 rounded-2xl text-2xl font-bold text-white transition-colors active:brightness-95"
      >
        {actionLabel}
      </button>
    </div>
  )
}
