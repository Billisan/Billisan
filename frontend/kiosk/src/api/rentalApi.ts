export interface RentalStart {
  slotNumber: number
  rentedAt: string
  dueAt: string
}

// 수동 테스트 시나리오 — MOCK_SLOT_NUMBER를 바꿔서 슬롯 번호를 확인한다.
const MOCK_SLOT_NUMBER = 3

// PROJECT_GUIDE.md §4 정산 정책 — 무료 대여 시간 24시간
const FREE_RENTAL_HOURS = 24

const MIN_DELAY_MS = 300
const MAX_DELAY_MS = 800

// KSK-RENT-001(PROJECT_GUIDE.md §5.4) 대응 Mock. 실제 네트워크 호출 없음. 슬롯 원자 선정은 서버 책임이라
// 여기서는 클라이언트가 임의로 고르지 않고 고정 시나리오 값을 그대로 반환한다.
export function startRental(): Promise<RentalStart> {
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)

  return new Promise((resolve) => {
    setTimeout(() => {
      const rentedAt = new Date()
      const dueAt = new Date(
        rentedAt.getTime() + FREE_RENTAL_HOURS * 60 * 60 * 1000,
      )

      resolve({
        slotNumber: MOCK_SLOT_NUMBER,
        rentedAt: rentedAt.toISOString(),
        dueAt: dueAt.toISOString(),
      })
    }, delay)
  })
}
