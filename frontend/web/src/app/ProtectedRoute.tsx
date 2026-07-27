import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { env } from '@/config/env';
import { useAuth } from '@/features/auth/hooks/useAuth';

/**
 * 인증이 필요한 라우트 보호 래퍼.
 * 미인증이면 로그인 페이지로 보내고, 로그인 후 원래 위치로 복귀할 수 있게 state 에 담습니다.
 */
export function ProtectedRoute() {
    const { isAuthenticated } = useAuth();
    const location = useLocation();

    // 로그인 미구현 구간: 플래그가 켜져 있으면 검사 없이 통과시킵니다.
    // TODO: 로그인 API 연동 후 env.authBypass 와 이 분기를 함께 삭제하세요.
    if (env.authBypass) {
        return <Outlet />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    return <Outlet />;
}
