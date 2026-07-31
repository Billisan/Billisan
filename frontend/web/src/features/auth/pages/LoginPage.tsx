import { Navigate, useLocation } from 'react-router-dom';

import { BillisanLogo } from '@/components/brand/BillisanLogo';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { returnPathOf } from '@/features/auth/lib/returnPath';
import { PageTitle } from '@/shared/components/PageTitle';

/**
 * 관리자 로그인 화면 — `SCR-WEB-AUTH-001` (P0, `ADMIN-AUTH-001~003`).
 *
 * 시안 기준: 420x364 카드, 반경 16, 좌우 여백 40, 그림자 10px.
 * 세션 만료로 튕겨 온 경우를 따로 안내합니다 (화면흐름 §16 의 401 처리).
 */
export function LoginPage() {
    const { isAuthenticated } = useAuth();
    const location = useLocation();
    const state = location.state as { expired?: boolean } | null;

    /*
     * 이미 로그인돼 있으면 보던 화면으로. **`/` 로 고정하면 안 됩니다.**
     *
     * 로그인 성공 순간에는 이 분기와 `useLogin` 의 `onSuccess` 가 거의 동시에 돕니다.
     * 여기가 `/` 로 고정돼 있던 동안에는 `useLogin` 이 복귀시켜 놓아도 이쪽이 덮어써서,
     * 세션이 끊겨 튕긴 사람이 다시 로그인하면 늘 대시보드로 떨어졌습니다.
     * 두 곳이 같은 `returnPathOf` 를 쓰므로 어느 쪽이 이기든 결과가 같습니다.
     */
    if (isAuthenticated) {
        return <Navigate to={returnPathOf(state)} replace />;
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-brand-canvas p-6">
            <div className="w-[420px] rounded-2xl bg-white px-10 pb-10 pt-11 shadow-[0_10px_28px_rgba(11,18,32,0.08)]">
                {/* 로고가 제목 자리를 대신해서 글자는 숨기고 제목 구조만 남깁니다. */}
                <PageTitle visuallyHidden>관리자 로그인</PageTitle>

                <div className="flex justify-center">
                    <BillisanLogo className="h-[32px]" wordColor="#1E252B" />
                </div>

                <div className="mt-[33px]">
                    <LoginForm />
                </div>

                {state?.expired && (
                    <p className="mt-[14px] text-center text-[11.5px] font-medium text-brand-muted">
                        세션이 만료되어 로그아웃되었습니다. 다시 로그인해 주세요.
                    </p>
                )}
            </div>
        </div>
    );
}
