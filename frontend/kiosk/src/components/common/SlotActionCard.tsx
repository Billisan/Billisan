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
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-evenly">
      <div className="flex flex-col items-center gap-12">
        <UmbrellaSlotAnimationIcon direction={type} speed={3} scale={1.4} />

        <div className="flex flex-col items-center">
          <p className="text-tertiary-text text-xl">{label}</p>
          <p className="text-8xl font-bold text-black">
            {String(slotNumber).padStart(2, '0')}
          </p>
        </div>

        <p className="text-2xl font-medium text-black">{message}</p>
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
