import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { ReturnIcon } from '../../components/icons/ReturnIcon'
import { UmbrellaIcon } from '../../components/icons/UmbrellaIcon'
import { KioskLayout } from '../../components/layout/KioskLayout'

export type MainScreenVariant = 'DEFAULT' | 'RENT_DISABLED_NO_STOCK'

interface MainScreenProps {
  variant: MainScreenVariant
}

// 8번 단계(kioskMainStore 연동)까지 시각 확인용 임시 우산 개수 값
const MOCK_USABLE_SLOT_COUNT: Record<MainScreenVariant, number> = {
  DEFAULT: 2,
  RENT_DISABLED_NO_STOCK: 0,
}

export function MainScreen({ variant }: MainScreenProps) {
  const isRentDisabled = variant === 'RENT_DISABLED_NO_STOCK'
  const usableSlotCount = MOCK_USABLE_SLOT_COUNT[variant]

  return (
    <KioskLayout>
      <p className="text-tertiary-text flex flex-row items-baseline gap-3 text-2xl font-medium">
        현재 대여 가능한 우산
        <span className="text-3xl font-bold text-black">
          {usableSlotCount}개
        </span>
      </p>

      <div className="flex w-full flex-row items-start justify-center gap-16">
        <div className="flex min-w-0 max-w-75 flex-1 flex-col items-center gap-2">
          <Button disabled={isRentDisabled} className="w-full">
            <span className="flex flex-col items-center justify-center gap-4">
              <UmbrellaIcon className="h-[57.6px] w-[57.6px]" />
              대여
            </span>
          </Button>
          {isRentDisabled && <Badge>우산 재고 없음</Badge>}
        </div>

        <div className="flex min-w-0 max-w-75 flex-1 flex-col items-center gap-2">
          <Button variant="outline" className="w-full">
            <span className="flex flex-col items-center justify-center gap-6">
              <ReturnIcon className="h-12 w-12" />
              반납
            </span>
          </Button>
        </div>
      </div>
    </KioskLayout>
  )
}
