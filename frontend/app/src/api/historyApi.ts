import { apiClient } from './client'
import type { RentalHistoryResponse } from '../types/history'
import type { RentalStatus } from '../types/rental'

interface GetRentalHistoryParams {
  // RENTAL-002 문서화된 필터(§5.6)는 HistoryStatusFilter(ALL|ACTIVE|COMPLETED|LOST|FAILED)뿐이지만,
  // 백엔드는 Rental.Status 값을 그대로 등가 비교한다(RentalAppService.buildFilter) — "대여중" 필터에
  // RETURNING(반납 시도 중) 연체 건도 포함시키기 위해 HistoryScreen.tsx가 RETURNING으로도 조회한다
  // (2026-08-09, PLAN docs/plans/2026-08-09-SCR-APP-HISTORY-001-active-filter.md).
  status?: RentalStatus | 'ALL'
  cursor?: string | null
  size?: number
}

// RENTAL-002(PROJECT_GUIDE.md §5.6).
export async function getRentalHistory({
  status = 'ALL',
  cursor,
  size,
}: GetRentalHistoryParams = {}): Promise<RentalHistoryResponse> {
  const response = await apiClient.get<RentalHistoryResponse>('/api/v1/rentals', {
    params: { status, cursor: cursor ?? undefined, size },
  })
  return response.data
}
