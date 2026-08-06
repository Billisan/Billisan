import { apiClient } from './client'
import type { LoginRequest, LoginResponse } from '../types/auth'

// AUTH-001(PROJECT_GUIDE.md §5.1). 응답은 `data` 래퍼 없이 평평한 구조로 온다
// (문서 §5 공통 규칙과 다름 — 2026-08-06 실제 호출로 확인, 실제 응답을 우선한다).
export async function login(request: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/api/v1/auth/login', request)
  return response.data
}

// AUTH-002(PROJECT_GUIDE.md §5.2).
export async function logout(): Promise<{ loggedOut: true }> {
  const response = await apiClient.post<{ loggedOut: true }>('/api/v1/auth/logout')
  return response.data
}
