import { apiClient } from './client'
import type { AlertItem } from '../types/alert'

interface AlertsResponse {
  items: AlertItem[]
}

// ALERT-001(PROJECT_GUIDE.md §5.11).
export async function getAlerts(): Promise<AlertItem[]> {
  const response = await apiClient.get<AlertsResponse>('/api/v1/app/alerts')
  return response.data.items
}
