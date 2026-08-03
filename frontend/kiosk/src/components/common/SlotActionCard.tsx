import UmbrellaSlotAnimationIcon from '../icons/UmbrellaSlotAnimationIcon'

interface SlotActionCardProps {
  slotNumber: number
  label: string
  message: string
  type: 'rental' | 'return'
}

// 완료 전환은 Pi RESULT 신호로만 판단한다("꺼냈어요"/"넣었어요" 클릭은 완료 API가 아님) —
// 그래서 버튼 없이 안내만 보여주고, 화면 전환은 RentFlow/ReturnFlow가 자동으로 처리한다.
export function SlotActionCard({
  slotNumber,
  label,
  message,
  type,
}: SlotActionCardProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center">
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
    </div>
  )
}
