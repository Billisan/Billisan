import { useMutation } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';

import { authApi } from '@/features/auth/api/authApi';
import { useResetSessionRestore } from '@/features/auth/hooks/useSessionRestore';
import { returnPathOf } from '@/features/auth/lib/returnPath';
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
    const location = useLocation();
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
            /*
             * 보던 화면으로 돌려보냅니다 (화면흐름 §15: "현재 URL을 안전하게 저장하고
             * 로그인 후 복귀 가능 여부를 결정한다").
             *
             * `ProtectedRoute` 가 `from` 을 담아 보내고 있었는데 여기서 안 읽고 늘 `/`
             * 로 보냈습니다. 세션이 끊겨 튕긴 사람이 다시 로그인하면 대시보드로 떨어져서,
             * 보던 검수 건을 손으로 다시 찾아 들어가야 했습니다.
             */
            navigate(returnPathOf(location.state), { replace: true });
        },
    });
}
