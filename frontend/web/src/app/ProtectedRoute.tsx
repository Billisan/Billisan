import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { env } from '@/config/env';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSessionRestore } from '@/features/auth/hooks/useSessionRestore';
import { useSessionWatch } from '@/features/auth/hooks/useSessionWatch';
import { isSessionAlive, useAuthStore } from '@/features/auth/stores/authStore';

/**
 * 인증이 필요한 라우트 보호 래퍼.
 *
 * 화면흐름 §15: 보호 라우트 진입 전 FE 가 세션 유무를 확인하되 **최종 권한은 Spring 이 검증**합니다.
 * 여기서 막는 건 화면 이동일 뿐이고, 모든 명령은 서버가 다시 검사합니다 (§18).
 *
 * 세션 기준은 `DEC-SESSION-001` — 유휴 30분, 절대 8시간.
 * 만료되면 현재 위치를 들고 로그인으로 보내고 만료였다는 사실을 함께 넘깁니다 (§16 의 401 처리).
 */
export function ProtectedRoute() {
    const { isAuthenticated } = useAuth();
    const location = useLocation();
    const touch = useAuthStore((s) => s.touch);
    const clearAuth = useAuthStore((s) => s.clearAuth);

    // 새로고침 직후에는 메모리가 비어 있습니다. `/auth/me` 로 한 번 물어본 뒤에 판단합니다.
    const restored = useSessionRestore();

    /*
     * 유휴·절대 만료 감시 (DEC-SESSION-001).
     * 클릭·키입력·스크롤을 활동으로 보고, 1분마다 만료를 확인합니다.
     */
    useSessionWatch();

    const alive = env.authBypass || isSessionAlive();

    // 화면 이동도 활동입니다. 키보드 이동이나 코드로 옮기는 경우엔 이벤트가 안 잡혀서 따로 둡니다.
    useEffect(() => {
        if (alive && !env.authBypass) touch();
    }, [location.pathname, alive, touch]);

    // 만료된 세션이 남아 있으면 흔적을 지웁니다. 토큰은 메모리에만 있으니 이걸로 끝입니다.
    useEffect(() => {
        if (!env.authBypass && isAuthenticated && !alive) clearAuth();
    }, [isAuthenticated, alive, clearAuth]);

    // 로그인 미구현 구간용 우회. .env 의 VITE_AUTH_BYPASS 로만 켜집니다.
    // TODO: 로그인 API 연동이 끝나면 env.authBypass 와 이 분기를 함께 삭제하세요.
    if (env.authBypass) {
        return <Outlet />;
    }

    // 복원 결과가 나오기 전에 로그인 화면으로 보내면, 새로고침할 때마다 로그인 폼이 번쩍입니다.
    if (!restored) {
        return <SessionRestoring />;
    }

    if (!alive) {
        return (
            <Navigate to="/login" replace state={{ from: location, expired: isAuthenticated }} />
        );
    }

    return <Outlet />;
}

function SessionRestoring() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-brand-canvas">
            <p className="text-[13px] font-medium text-brand-muted" role="status">
                세션을 확인하고 있습니다…
            </p>
        </div>
    );
}
