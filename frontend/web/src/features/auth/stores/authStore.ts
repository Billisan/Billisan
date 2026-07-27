import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AdminUser } from '@/features/auth/types';

interface AuthState {
    accessToken: string | null;
    user: AdminUser | null;
    /** 로그인 성공 시 토큰/유저 저장 */
    setAuth: (payload: { accessToken: string; user: AdminUser }) => void;
    /** 로그아웃/토큰 만료 시 초기화 */
    clearAuth: () => void;
}

/**
 * 인증 클라이언트 상태.
 * accessToken 은 localStorage 에 persist 되어 새로고침에도 로그인 유지됩니다.
 * (보안 강화가 필요하면 추후 httpOnly 쿠키 방식으로 교체)
 */
export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            accessToken: null,
            user: null,
            setAuth: ({ accessToken, user }) => set({ accessToken, user }),
            clearAuth: () => set({ accessToken: null, user: null }),
        }),
        {
            name: 'billisan-admin-auth',
            partialize: (state) => ({
                accessToken: state.accessToken,
                user: state.user,
            }),
        },
    ),
);

/** 스토어 밖(예: axios 인터셉터)에서 토큰을 읽기 위한 헬퍼 */
export const getAccessToken = () => useAuthStore.getState().accessToken;
