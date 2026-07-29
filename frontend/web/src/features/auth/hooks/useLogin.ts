import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { authApi } from '@/features/auth/api/authApi';
import { resetSessionRestore } from '@/features/auth/hooks/useSessionRestore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import type { LoginRequest } from '@/features/auth/types';

/**
 * 로그인 뮤테이션 훅 — `ADMIN-AUTH-001`.
 * 성공 시 토큰·관리자 정보를 스토어에 저장하고 대시보드로 이동합니다.
 *
 * 실패는 재시도하지 않습니다. 관리자 오류 10종은 전부 `retryable=false` 입니다 (API명세 B-5).
 */
export function useLogin() {
    const navigate = useNavigate();
    const setAuth = useAuthStore((s) => s.setAuth);

    return useMutation({
        mutationFn: (payload: LoginRequest) => authApi.login(payload),
        retry: false,
        onSuccess: (data) => {
            // login() 이 필요하면 /auth/me 까지 부르고 오므로 여기서는 항상 user 가 있습니다.
            if (!data.user) return;

            setAuth({ accessToken: data.accessToken, user: data.user, session: data.session });
            resetSessionRestore();
            navigate('/', { replace: true });
        },
    });
}
