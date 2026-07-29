import { env } from '@/config/env';
import { useAuthStore } from '@/features/auth/stores/authStore';
import type { AdminUser } from '@/features/auth/types';
import { CAMPUS_NAME } from '@/shared/constants/organization';

/**
 * 로그인 미구현 구간에서 헤더 등에 표시할 임시 관리자.
 * TODO: env.authBypass 제거 시 같이 삭제하세요.
 */
const BYPASS_ADMIN: AdminUser = {
    userId: '00000000-0000-4000-8000-0000000000ff',
    loginId: 'fixture-eeffb8116982@example.invalid',
    name: `${CAMPUS_NAME}_관리자`,
    role: 'ADMIN',
};

/**
 * 인증 상태 조회용 훅.
 * 컴포넌트에서 로그인 여부/유저 정보를 간편하게 읽습니다.
 */
export function useAuth() {
    const user = useAuthStore((s) => s.user);
    const clearAuth = useAuthStore((s) => s.clearAuth);

    if (env.authBypass) {
        return {
            user: user ?? BYPASS_ADMIN,
            isAuthenticated: true,
            logout: clearAuth,
        };
    }

    return {
        user,
        /*
         * 토큰이 아니라 `user` 로 판단합니다.
         *
         * 새로고침 뒤 세션을 httpOnly 쿠키로 복원하면 Bearer 토큰이 없는 채로 로그인 상태가
         * 됩니다. 토큰 유무로 보면 그 경우를 '비로그인'으로 잘못 판정합니다.
         */
        isAuthenticated: Boolean(user),
        logout: clearAuth,
    };
}
