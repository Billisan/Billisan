import { env } from '@/config/env';
import { useAuthStore } from '@/features/auth/stores/authStore';
import type { AdminUser } from '@/features/auth/types';
import { CAMPUS_NAME } from '@/shared/constants/organization';

/**
 * 로그인 미구현 구간에서 헤더 등에 표시할 임시 관리자.
 * TODO: env.authBypass 제거 시 같이 삭제하세요.
 */
const BYPASS_ADMIN: AdminUser = {
    id: 0,
    email: 'fixture-eeffb8116982@example.invalid',
    name: `${CAMPUS_NAME}_관리자`,
    role: 'SUPER_ADMIN',
};

/**
 * 인증 상태 조회용 훅.
 * 컴포넌트에서 로그인 여부/유저 정보를 간편하게 읽습니다.
 */
export function useAuth() {
    const user = useAuthStore((s) => s.user);
    const accessToken = useAuthStore((s) => s.accessToken);
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
        isAuthenticated: Boolean(accessToken),
        logout: clearAuth,
    };
}
