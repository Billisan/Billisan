import { apiClient } from './client'
import type { PendingSettlementsResponse } from '../types/settlement'

// SETTLEMENT-001(PROJECT_GUIDE.md §5.7).
export async function getPendingSettlements(): Promise<PendingSettlementsResponse> {
  const response = await apiClient.get<PendingSettlementsResponse>('/api/v1/settlements/pending')
  return response.data
}
