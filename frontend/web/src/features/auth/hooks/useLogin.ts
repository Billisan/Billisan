import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { authApi } from '@/features/auth/api/authApi';
import { useResetSessionRestore } from '@/features/auth/hooks/useSessionRestore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import type { LoginRequest } from '@/features/auth/types';

/**
 * 로그인 뮤테이션 훅 — `ADMIN-AUTH-001`.
 *
 * 응답이 평평합니다. 관리자 신원과 만료 시각이 토큰과 같은 층에 옵니다.
 * 실패는 재시도하지 않습니다. 관리자 오류 10종은 전부 `retryable=false` 입니다 (B-6).
 */
export function useLogin() {
    const navigate = useNavigate();
    const setAuth = useAuthStore((s) => s.setAuth);
    // 이전 사람의 /auth/me 응답이 캐시에 남아 있으면 안 됩니다.
    const resetSessionRestore = useResetSessionRestore();

    return useMutation({
        mutationFn: (payload: LoginRequest) => authApi.login(payload),
        retry: false,
        onSuccess: ({ accessToken, adminId, loginId, role, idleExpiresAt, absoluteExpiresAt }) => {
            setAuth({
                accessToken,
                admin: { adminId, loginId, role },
                session: { idleExpiresAt, absoluteExpiresAt },
            });
            resetSessionRestore();
            navigate('/', { replace: true });
        },
    });
}
