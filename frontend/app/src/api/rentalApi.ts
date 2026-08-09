import { apiClient } from './client'
import type { CurrentRentalDetail } from '../types/rental'

// RENTAL-001(PROJECT_GUIDE.md §5.5). 활성 대여 없으면 서버가 `data:null`을 준다.
export async function getCurrentRental(): Promise<CurrentRentalDetail | null> {
  const response = await apiClient.get<CurrentRentalDetail | null>('/api/v1/rentals/current')
  return response.data
}
