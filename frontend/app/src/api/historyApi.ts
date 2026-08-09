import { apiClient } from './client'
import type { HistoryStatusFilter, RentalHistoryResponse } from '../types/history'

interface GetRentalHistoryParams {
  status?: HistoryStatusFilter
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
