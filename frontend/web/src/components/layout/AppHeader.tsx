import { Bell, LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { authApi } from '@/features/auth/api/authApi';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { resetSessionRestore } from '@/features/auth/hooks/useSessionRestore';
import { cn } from '@/lib/utils';

/**
 * 상단 헤더.
 *
 * 시안(대여소 관리.svg)의 헤더는 사이드바와 같은 네이비 한 판이고 좌측은 비어 있습니다.
 * 페이지 제목과 전역 검색은 시안에 없어서 두지 않습니다. 현재 위치는 각 화면의 PageBar 가 보여줍니다.
 * 아래 5px 띠(#0B1220 5%)는 대여소 상세 시안에 있는 값이며, 본문이 헤더 밑으로 스크롤되므로 z-10 이 필요합니다.
 */
export function AppHeader() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const displayName = user?.name ?? '관리자';
    // 아바타 이니셜은 계정(loginId) 기준 — 한글 이름 첫 글자가 들어가면 시안과 달라집니다.
    const initial = (user?.loginId ?? displayName).trim().slice(0, 1).toUpperCase();

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
        try {
            await authApi.logout();
        } finally {
            logout();
            queryClient.clear();
            // 다음 로그인 전까지 /auth/me 복원을 다시 시도할 수 있게 풀어 줍니다.
            resetSessionRestore();
            navigate('/login', { replace: true });
        }
    };

    return (
        <header className="relative z-10 flex h-[104px] shrink-0 items-center justify-end bg-brand-navy pr-9 shadow-[0_5px_0_0_rgba(11,18,32,0.05)]">
            <button
                type="button"
                className="relative flex size-9 items-center justify-center rounded-lg text-brand-navy-label transition-colors hover:bg-brand-navy-hover"
                // TODO: 알림 목록 팝오버 연결
            >
                <span className="sr-only">알림</span>
                <Bell className="size-[19px]" aria-hidden />
                {/* 시안의 점은 흰 테두리가 아니라 헤더 배경색으로 파낸 형태입니다. */}
                <span
                    className="absolute right-[7px] top-[6px] size-[9px] rounded-full border-2 border-brand-navy bg-status-shortage"
                    aria-hidden
                />
            </button>

            <span className="ml-[11px] h-9 w-px bg-brand-navy-badge" aria-hidden />

            <div ref={menuRef} className="relative ml-[21px]">
                <button
                    type="button"
                    onClick={() => setOpen((prev) => !prev)}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    className="flex items-center gap-3 rounded-lg py-1 pl-2 pr-1 transition-colors hover:bg-brand-navy-hover"
                >
                    <span className="hidden text-[12.5px] font-semibold text-white xl:block">
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
                            {/* 표시하는 계정 정보는 loginId 까지입니다. 그 밖의 개인정보는 두지 않습니다 (§6.3). */}
                            <p className="mt-[3px] truncate text-[11.5px] font-medium text-brand-muted">
                                {user?.loginId}
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
