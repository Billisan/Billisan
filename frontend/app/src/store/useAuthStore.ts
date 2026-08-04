import { create } from 'zustand'
import type { AuthUser, LoginResponse } from '../types/auth'

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  setAuth: (response: LoginResponse) => void
  clearAuth: () => void
}

// 2026-07-31 결정 — 토큰은 Zustand 메모리에만 둔다(영속 저장 없음). 앱을 껐다 켜면
// 다시 로그인해야 하는 게 이번 결정에 따른 정상 동작이다. 영속 저장이 필요해지면
// expo-secure-store 등 새 라이브러리 도입을 별도 승인받고 추가한다.
//
// 실제 API 호출(login/logout)은 TanStack Query의 useMutation으로 각 화면에서 수행하고,
// 이 스토어는 그 결과로 상태만 갱신한다.
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,

  setAuth: (response) => set({ accessToken: response.accessToken, user: response.user }),

  clearAuth: () => set({ accessToken: null, user: null }),
}))
