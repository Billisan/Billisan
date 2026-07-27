import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { authApi } from '@/features/auth/api/authApi';
import { useAuthStore } from '@/features/auth/stores/authStore';
import type { LoginRequest } from '@/features/auth/types';

/**
 * 로그인 뮤테이션 훅.
 * 성공 시 토큰/유저를 스토어에 저장하고 대시보드로 이동합니다.
 */
export function useLogin() {
    const navigate = useNavigate();
    const setAuth = useAuthStore((s) => s.setAuth);

    return useMutation({
        mutationFn: (payload: LoginRequest) => authApi.login(payload),
        onSuccess: (data) => {
            setAuth({ accessToken: data.accessToken, user: data.user });
            navigate('/', { replace: true });
        },
    });
}
