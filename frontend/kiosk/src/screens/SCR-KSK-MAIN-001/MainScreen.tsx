import { Button } from '../../components/common/Button'
import { KioskLayout } from '../../components/layout/KioskLayout'

export type MainScreenVariant = 'DEFAULT' | 'RENT_DISABLED_NO_STOCK'

interface MainScreenProps {
  variant: MainScreenVariant
}

// 8번 단계(kioskMainStore 연동)까지 시각 확인용 임시 값. 실제 조회값으로 교체 예정.
const MOCK_USABLE_SLOT_COUNT: Record<MainScreenVariant, number> = {
  DEFAULT: 3,
  RENT_DISABLED_NO_STOCK: 0,
}

export function MainScreen({ variant }: MainScreenProps) {
  const isRentDisabled = variant === 'RENT_DISABLED_NO_STOCK'
  const usableSlotCount = MOCK_USABLE_SLOT_COUNT[variant]

  return (
    <KioskLayout>
      <p className="text-navy/70 text-xl">
        현재 대여 가능한 우산 {usableSlotCount}개
      </p>

      <div className="flex w-full flex-row items-start gap-4">
        <div className="flex flex-1 flex-col items-center gap-2">
          <Button disabled={isRentDisabled} className="w-full">
            대여
          </Button>
          {isRentDisabled && (
            <span className="bg-error-bg text-error-text rounded-full px-4 py-1 text-base font-semibold">
              우산 재고 없음
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col items-center gap-2">
          <Button variant="outline" className="w-full">
            반납
          </Button>
        </div>
      </div>
    </KioskLayout>
  )
}
