import { create } from 'zustand'
import { fetchStationSummary as fetchStationSummaryMock } from '../api/stationApi'
import type { RentalBlockReason } from '../types/eligibility'
import { MAIN_SCREEN_VARIANT, type MainScreenVariant } from '../types/slot'

interface KioskMainState {
  usableSlotCount: number | null // 대여 가능한 우산 개수
  returnableSlotCount: number | null // 반납 가능한 우산함(빈 슬롯) 개수 — 표시 전용, variant 계산엔 관여 안 함
  isLoading: boolean // 지금 조회 중인지
  isStale: boolean // 방금 받은 숫자가 오래된 값일 수도 있는지
  error: string | null // 조회하다가 실패했으면 에러 메시지
  fetchStationSummary: () => Promise<void> // "지금 재고 좀 다시 확인해줘"라고 부르는 함수
  rentalBlockReason: RentalBlockReason | null // 얼굴 인증 후 정책 검증에서 대여가 막힌 사유 — 있으면 메인 화면이 모달을 띄운다
  setRentalBlockReason: (reason: RentalBlockReason) => void
  clearRentalBlockReason: () => void
  // 대여/반납 완료 RESULT(KIOSK.RENT.RESULT, KIOSK.RETURN.RESULT)의 inventory를 받아 재고를
  // 즉시 반영한다. Spring 미연동으로 null이 오면 재고 0으로 오인하지 않도록 아무것도 바꾸지 않는다.
  applyInventorySnapshot: (
    inventory: { rentableSlotCount: number; emptyReturnSlotCount: number } | null,
  ) => void
}

export const useKioskMainStore = create<KioskMainState>((set) => ({
  usableSlotCount: null,
  returnableSlotCount: null,
  isLoading: true, // MainScreen이 마운트되면 바로 조회를 시작하므로, 초기값부터 로딩 중으로 둬서 깜빡임을 막는다
  isStale: false,
  error: null,
  fetchStationSummary: async () => {
    set({ isLoading: true, error: null })
    try {
      const summary = await fetchStationSummaryMock()
      set({
        usableSlotCount: summary.usableSlotCount,
        returnableSlotCount: summary.returnableSlotCount,
        isStale: summary.stale,
        isLoading: false,
      })
    } catch {
      set({ error: '재고 정보를 확인할 수 없습니다.', isLoading: false })
    }
  },
  rentalBlockReason: null,
  setRentalBlockReason: (reason) => set({ rentalBlockReason: reason }),
  clearRentalBlockReason: () => set({ rentalBlockReason: null }),
  applyInventorySnapshot: (inventory) => {
    if (!inventory) return
    set({
      usableSlotCount: inventory.rentableSlotCount,
      returnableSlotCount: inventory.emptyReturnSlotCount,
      isStale: false,
      error: null,
    })
  },
}))

// usableSlotCount(SSOT)에서 화면 variant를 파생시킨다 — 스토어 상태로 별도 저장하지 않음.
// 09번 문서 §3.1 "Partial Success": 수량을 알 수 없으면(null) 대여만 보수적으로 차단한다.
// 단, 최초 조회가 아직 끝나기 전(isLoading)에는 null도 "모름"으로 잡혀 매번 깜빡이므로,
// 로딩 중에는 판단을 보류하고 조회가 끝난 뒤의 값으로만 차단 여부를 정한다.
export function selectMainScreenVariant(
  state: KioskMainState,
): MainScreenVariant {
  if (state.isLoading) return MAIN_SCREEN_VARIANT.DEFAULT

  const isUnknownOrEmpty =
    state.usableSlotCount === null || state.usableSlotCount === 0

  return isUnknownOrEmpty || state.isStale || state.error
    ? MAIN_SCREEN_VARIANT.RENT_DISABLED_NO_STOCK
    : MAIN_SCREEN_VARIANT.DEFAULT
}

// 09-screen-flow.md §2·§3.1 RETURN_DISABLED_NO_CAPACITY — 빈 반납 슬롯이 0이거나
// 수치를 못 믿을 상태면 반납도 보수적으로 차단한다. rent와 독립적으로 꺼질 수 있어
// selectMainScreenVariant의 단일 enum과는 별도 selector로 둔다. 로딩 중 판단 보류 원칙은 동일.
export function selectIsReturnDisabled(state: KioskMainState): boolean {
  if (state.isLoading) return false

  const isUnknownOrEmpty =
    state.returnableSlotCount === null || state.returnableSlotCount === 0

  return isUnknownOrEmpty || state.isStale || Boolean(state.error)
}
