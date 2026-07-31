import { create } from 'zustand'
import { login as loginApi, logout as logoutApi } from '../api/authApi'
import type { AuthUser, LoginRequest } from '../types/auth'

type LoginResult = 'SUCCESS' | 'INVALID_CREDENTIALS'

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  login: (request: LoginRequest) => Promise<LoginResult>
  logout: () => Promise<void>
}

// 2026-07-31 결정 — 토큰은 Zustand 메모리에만 둔다(영속 저장 없음). 앱을 껐다 켜면
// 다시 로그인해야 하는 게 이번 결정에 따른 정상 동작이다. 영속 저장이 필요해지면
// expo-secure-store 등 새 라이브러리 도입을 별도 승인받고 추가한다.
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,

  login: async (request) => {
    try {
      const response = await loginApi(request)
      set({ accessToken: response.accessToken, user: response.user })
      return 'SUCCESS'
    } catch {
      return 'INVALID_CREDENTIALS'
    }
  },

  logout: async () => {
    await logoutApi()
    set({ accessToken: null, user: null })
  },
}))
