import { LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { NotificationBell } from '@/components/layout/NotificationBell';
import { authApi } from '@/features/auth/api/authApi';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { errorCodeOf } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import { toast } from '@/shared/components/toast/toastStore';

/**
 * 상단 헤더.
 *
 * 시안(대여소 관리.svg)의 헤더는 사이드바와 같은 네이비 한 판이고 좌측은 비어 있습니다.
 * 페이지 제목과 전역 검색은 시안에 없어서 두지 않습니다. 현재 위치는 각 화면의 PageBar 가 보여줍니다.
 * 아래 5px 띠(#0B1220 5%)는 대여소 상세 시안에 있는 값이며, 본문이 헤더 밑으로 스크롤되므로 z-10 이 필요합니다.
 */
export function AppHeader() {
    const { admin, logout } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    /*
     * 관리자 응답에 이름 필드가 없습니다 (12-R B-3). `adminId`·`loginId`·`role` 뿐이라
     * 화면에 쓸 수 있는 표시값은 loginId 하나입니다. 시안의 '빌리대학교_관리자' 는
     * 만들 수 없어서 계정 아이디를 그대로 보여줍니다.
     */
    const displayName = admin?.loginId ?? '관리자';
    const initial = displayName.trim().slice(0, 1).toUpperCase();

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };

        document.addEventListener('mousedown', onPointerDown);
        window.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    /**
     * 로그아웃 — `ADMIN-AUTH-002 POST /api/v1/admin/auth/logout` (멱등).
     * 화면흐름 §15: "로그아웃 성공 후 서버 세션·클라이언트 토큰·캐시된 사용자 데이터를 제거한다."
     * 서버 호출이 실패해도 클라이언트 흔적은 반드시 지웁니다.
     */
    const handleLogout = async () => {
        setOpen(false);
        /*
         * **서버 실패를 삼키되, 조용히 넘기지는 않습니다.**
         *
         * 예전에는 catch 없이 try/finally 라 오류가 그대로 튀어 올랐고,
         * onClick 은 Promise 를 안 받으므로 처리되지 않은 거부가 됐습니다.
         * 화면은 멀쩡해 보이는데 콘솔에는 매번 터지고 있었습니다.
         *
         * 더 중요한 건 관리자가 받는 인상입니다. 서버 로그아웃이 실패하면
         * **세션이 서버에 남아 있을 수 있는데** 화면은 끊긴 것처럼 보였습니다.
         * 로컬 흔적은 반드시 지우되(로그아웃을 누른 사람을 로그인 상태로 두면 안 됨),
         * 서버 쪽이 안 끝났다는 사실은 알려 줍니다.
         */
        let serverFailed: unknown = null;
        try {
            await authApi.logout();
        } catch (error) {
            serverFailed = error;
        }

        logout();
        // `clear()` 가 `/auth/me` 캐시까지 지웁니다 — 다음 로그인 전까지 복원이 다시 됩니다.
        queryClient.clear();
        navigate('/login', { replace: true });

        if (serverFailed) {
            const code = errorCodeOf(serverFailed);
            toast.error(
                '이 기기에서는 로그아웃했습니다',
                `서버 세션 종료를 확인하지 못했습니다. 공용 PC 라면 브라우저를 닫으세요.${
                    code ? ` (${code})` : ''
                }`,
            );
        }
    };

    return (
        <header className="relative z-10 flex h-[104px] shrink-0 items-center justify-end bg-brand-navy pr-9 shadow-[0_5px_0_0_rgba(11,18,32,0.05)]">
            <NotificationBell />

            <span className="ml-[11px] h-9 w-px bg-brand-navy-badge" aria-hidden />

            <div ref={menuRef} className="relative ml-[21px]">
                <button
                    type="button"
                    onClick={() => setOpen((prev) => !prev)}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    className="flex items-center gap-3 rounded-lg py-1 pl-2 pr-1 transition-colors hover:bg-brand-navy-hover"
                >
                    <span className="hidden max-w-[220px] truncate text-[12.5px] font-semibold text-white xl:block">
                        {displayName}
                    </span>
                    <span className="flex size-[30px] items-center justify-center rounded-full bg-brand-blue text-[11.5px] font-extrabold text-white">
                        {initial}
                    </span>
                    {/* lucide 아이콘은 24 유닛 박스 여백 때문에 오른쪽 끝이 안 맞아서 시안 벡터로 그립니다. */}
                    <svg
                        viewBox="-0.95 -0.95 11.9 6.9"
                        width="11.9"
                        height="6.9"
                        className={cn(
                            '-ml-[2px] shrink-0 text-brand-navy-label transition-transform',
                            open && 'rotate-180',
                        )}
                        aria-hidden
                    >
                        <path
                            d="M0 0 L5 5 L10 0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </button>

                {open && (
                    <div
                        role="menu"
                        className="absolute right-0 top-[calc(100%+10px)] w-[212px] overflow-hidden rounded-[10px] bg-white py-[6px] shadow-[0_8px_24px_rgba(11,18,32,0.18)]"
                    >
                        <div className="px-[14px] pb-[9px] pt-[6px]">
                            <p className="truncate text-[12.5px] font-bold text-brand-ink">
                                {displayName}
                            </p>
                            {/*
                             * 표시할 수 있는 건 역할까지입니다. 그 밖의 개인정보는 두지 않습니다.
                             *
                             * 분기를 걷어냈습니다. 계약 DB v3.0 의 `ADMIN-AUTH-001` 이
                             * "응답의 `role=ADMIN` 은 DB 컬럼이 아니라 인증 채널에서 파생한
                             * 고정 주체 표시" 라고 못 박았습니다. 관리자 채널로 로그인했으면
                             * 항상 `ADMIN` 이라 `'-'` 는 나올 수 없는 값이었습니다.
                             * 관리자가 아닌 주체는 로그인 자체가 403 ADMIN_ACCOUNT_REQUIRED 입니다.
                             */}
                            <p className="mt-[3px] truncate text-[11.5px] font-medium text-brand-muted">
                                관리자
                            </p>
                        </div>

                        <span className="block h-px bg-brand-line-soft" aria-hidden />

                        <button
                            type="button"
                            role="menuitem"
                            onClick={handleLogout}
                            className="mt-[5px] flex w-full items-center gap-[9px] px-[14px] py-[9px] text-left text-[12.5px] font-semibold text-brand-body transition-colors hover:bg-brand-surface"
                        >
                            <LogOut className="size-[15px]" strokeWidth={2.1} aria-hidden />
                            로그아웃
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
