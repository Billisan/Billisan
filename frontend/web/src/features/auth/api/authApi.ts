import { http } from '@/lib/axios';
import type { AdminUser, LoginRequest, LoginResponse } from '@/features/auth/types';

/**
 * 인증 관련 서버 통신.
 * 엔드포인트/응답 필드는 백엔드 API 명세 확정되면 맞춰서 수정하세요.
 */
export const authApi = {
    /** 관리자 로그인 */
    login: async (payload: LoginRequest): Promise<LoginResponse> => {
        const { data } = await http.post<LoginResponse>('/auth/login', payload);
        return data;
    },

    /** 내 정보 조회 (토큰 유효성 확인용) */
    me: async (): Promise<AdminUser> => {
        const { data } = await http.get<AdminUser>('/auth/me');
        return data;
    },

    /** 로그아웃 (서버 세션/토큰 무효화가 있다면) */
    logout: async (): Promise<void> => {
        await http.post('/auth/logout');
    },
};
