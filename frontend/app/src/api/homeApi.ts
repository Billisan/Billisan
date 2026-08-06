import { apiClient } from './client'
import type { HomeSummary } from '../types/home'

// HOME-001(PROJECT_GUIDE.md §5.4).
export async function getHomeSummary(): Promise<HomeSummary> {
  const response = await apiClient.get<HomeSummary>('/api/v1/app/home')
  return response.data
}
