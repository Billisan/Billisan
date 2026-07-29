import { env } from '@/config/env';
import { useAuthStore } from '@/features/auth/stores/authStore';
import type { AdminIdentity } from '@/features/auth/types';

/**
 * 로그인 미구현 구간에서 헤더 등에 표시할 임시 관리자.
 * TODO: env.authBypass 제거 시 같이 삭제하세요.
 */
const BYPASS_ADMIN: AdminIdentity = {
    adminId: '00000000-0000-4000-8000-0000000000ff',
    loginId: 'fixture-eeffb8116982@example.invalid',
    role: 'ADMIN',
};

/**
 * 인증 상태 조회용 훅.
 *
 * 관리자 응답에는 이름 필드가 없습니다. 화면에 쓸 수 있는 표시값은 `loginId` 뿐입니다.
 */
export function useAuth() {
    const admin = useAuthStore((s) => s.admin);
    const clearAuth = useAuthStore((s) => s.clearAuth);

    if (env.authBypass) {
        return { admin: admin ?? BYPASS_ADMIN, isAuthenticated: true, logout: clearAuth };
    }

    /*
     * 토큰이 아니라 `admin` 으로 판단합니다.
     *
     * 새로고침 뒤 세션을 httpOnly 쿠키로 복원하면 Bearer 토큰이 없는 채로 로그인 상태가
     * 됩니다. 토큰 유무로 보면 그 경우를 '비로그인'으로 잘못 판정합니다.
     */
    return { admin, isAuthenticated: Boolean(admin), logout: clearAuth };
}
