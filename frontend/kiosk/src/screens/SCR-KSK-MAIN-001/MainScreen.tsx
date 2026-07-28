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
  DEFAULT: 3,
  RENT_DISABLED_NO_STOCK: 0,
}

export function MainScreen({ variant }: MainScreenProps) {
  const isRentDisabled = variant === 'RENT_DISABLED_NO_STOCK'
  const usableSlotCount = MOCK_USABLE_SLOT_COUNT[variant]

  return (
    <KioskLayout>
      <p className="text-tertiary-text flex flex-row items-baseline gap-3 text-2xl">
        현재 대여 가능한 우산
        <span className="text-3xl font-bold text-black">
          {usableSlotCount}개
        </span>
      </p>

      <div className="flex w-full flex-row items-start justify-center gap-30">
        <div className="flex flex-col items-center gap-2">
          <Button disabled={isRentDisabled} className="w-100">
            <span className="flex flex-col items-center justify-center gap-4">
              <UmbrellaIcon className="h-[57.6px] w-[57.6px]" />
              대여
            </span>
          </Button>
          {isRentDisabled && (
            <span className="bg-error-bg text-error-text rounded-full px-4 py-1 text-base font-semibold">
              우산 재고 없음
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <Button variant="outline" className="w-100">
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
