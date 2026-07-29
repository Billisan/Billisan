import { Outlet } from 'react-router-dom';

import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';

/**
 * 인증된 관리자 화면의 공통 레이아웃.
 * 좌측 사이드바(252px) + 상단 헤더(104px) + 콘텐츠(Outlet) 구조이며,
 * 페이지 전체 스크롤 대신 콘텐츠 영역만 스크롤합니다.
 */
export function AppShell() {
    return (
        <div className="flex h-screen overflow-hidden bg-brand-canvas">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <AppHeader />
                <main className="min-h-0 flex-1 overflow-y-auto px-9 pb-9 pt-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
