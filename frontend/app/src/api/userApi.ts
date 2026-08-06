import { apiClient } from './client'
import { decodeMojibakeDisplayName } from '../lib/mojibake'
import type { MyPageProfile } from '../types/user'

// USER-001(PROJECT_GUIDE.md §5.3).
export async function getMe(): Promise<MyPageProfile> {
  const response = await apiClient.get<MyPageProfile>('/api/v1/users/me')
  return { ...response.data, displayName: decodeMojibakeDisplayName(response.data.displayName) }
}
