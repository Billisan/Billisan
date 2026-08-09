import { create } from 'zustand'
import { setAccessToken, setUnauthorizedHandler } from '../api/client'
import { clearSession, loadSession, saveSession } from '../lib/secureStorage'
import type { AuthUser, LoginResponse } from '../types/auth'
import { useAlertReadStore } from './useAlertReadStore'

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  isHydrating: boolean
  hydrate: () => Promise<void>
  setAuth: (response: LoginResponse) => void
  clearAuth: () => void
}

// 2026-08-06 — accessToken을 expo-secure-store로 영속화(이전 2026-07-31 결정을 대체).
// user는 로그인 직후에만 채워지고 화면들이 실제로 읽지 않아(각자 USER-001/HOME-001을 따로
// 조회), 부팅 시 별도로 복원하지 않는다 — 부팅 시엔 토큰만 복원하고, 만료된 토큰이면
// 탭 화면 진입 후 첫 실제 API 호출이 401을 받아 아래 clearAuth가 자동 호출된다
// (client.ts의 setUnauthorizedHandler 참고, 2026-08-06 사용자 확인).
//
// 실제 API 호출(login/logout)은 TanStack Query의 useMutation으로 각 화면에서 수행하고,
// 이 스토어는 그 결과로 상태만 갱신한다.
export const useAuthStore = create<AuthState>((set) => {
  const clearAuth = () => {
    setAccessToken(null)
    clearSession().catch(() => {})
    useAlertReadStore.getState().reset()
    set({ accessToken: null, user: null })
  }

  setUnauthorizedHandler(clearAuth)

  return {
    accessToken: null,
    user: null,
    isHydrating: true,

    hydrate: async () => {
      const session = await loadSession()
      if (session) {
        setAccessToken(session.accessToken)
        set({ accessToken: session.accessToken })
      }
      set({ isHydrating: false })
    },

    setAuth: (response) => {
      setAccessToken(response.accessToken)
      saveSession({ accessToken: response.accessToken, expiresAt: response.expiresAt }).catch(() => {})
      set({ accessToken: response.accessToken, user: response.user })
    },

    clearAuth,
  }
})
