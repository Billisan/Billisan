import { Bell, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { usePageTitleValue } from '@/components/layout/pageTitle';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { findNavItem } from '@/shared/constants/navigation';

export function AppHeader() {
    const { pathname } = useLocation();
    const { user } = useAuth();
    const overriddenTitle = usePageTitleValue();

    // 상세 화면처럼 페이지가 제목을 지정했으면 그 값을, 아니면 메뉴명을 씁니다.
    const title = overriddenTitle ?? findNavItem(pathname)?.label ?? '관리자 콘솔';
    const displayName = user?.name ?? '관리자';
    // 아바타 이니셜은 계정(이메일) 기준 — 한글 이름 첫 글자가 들어가면 시안과 달라집니다.
    const initial = (user?.email ?? displayName).trim().slice(0, 1).toUpperCase();

    return (
        <header className="relative flex h-[104px] shrink-0 items-center gap-6 border-b border-brand-line bg-white pl-9 pr-9">
            {/* 좌측 포인트 바 */}
            <span className="absolute inset-y-0 left-0 w-[3px] bg-brand-blue" aria-hidden />

            <h1 className="text-[21px] font-extrabold text-brand-ink">{title}</h1>

            {/* 시안은 요소마다 간격이 달라서 gap 하나로 묶지 않고 각자 ml 로 맞춥니다. */}
            <div className="ml-auto flex items-center">
                <label className="relative hidden lg:block">
                    <span className="sr-only">검색</span>
                    <Search
                        className="pointer-events-none absolute left-[15px] top-1/2 size-[14px] -translate-y-1/2 text-brand-placeholder"
                        aria-hidden
                    />
                    <input
                        type="search"
                        placeholder="대여소 · 거래ID"
                        className="h-9 w-[228px] rounded-[9px] bg-brand-field pl-[40px] pr-3 text-xs font-medium text-brand-ink outline-none transition-shadow placeholder:text-brand-placeholder focus-visible:ring-2 focus-visible:ring-brand-blue/40"
                    />
                </label>

                <button
                    type="button"
                    className="relative ml-[11px] flex size-9 items-center justify-center rounded-lg text-brand-body transition-colors hover:bg-brand-field"
                    // TODO: 알림 목록 팝오버 연결
                >
                    <span className="sr-only">알림</span>
                    <Bell className="size-[19px]" aria-hidden />
                    <span
                        className="absolute right-[7px] top-[6px] size-[9px] rounded-full border-2 border-white bg-status-shortage"
                        aria-hidden
                    />
                </button>

                <span className="ml-[11px] h-9 w-px bg-brand-divider" aria-hidden />

                <button
                    type="button"
                    className="ml-[18px] flex items-center gap-3 rounded-lg py-1 pl-2 transition-colors hover:bg-brand-field"
                    // TODO: 계정 드롭다운(프로필/로그아웃) 연결 — 로그인 구현 시 useAuth().logout 사용
                >
                    <span className="hidden text-[12.5px] font-semibold text-brand-body xl:block">
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
                        className="-ml-[2px] shrink-0 text-brand-placeholder"
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
            </div>
        </header>
    );
}
