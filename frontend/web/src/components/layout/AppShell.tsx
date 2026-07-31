import { useRef } from 'react';
import { Outlet } from 'react-router-dom';

import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { useScrollRestoration } from '@/shared/hooks/useScrollRestoration';

/**
 * 인증된 관리자 화면의 공통 레이아웃.
 * 좌측 사이드바(252px) + 상단 헤더(104px) + 콘텐츠(Outlet) 구조이며,
 * 페이지 전체 스크롤 대신 콘텐츠 영역만 스크롤합니다.
 *
 * 스크롤이 창이 아니라 `<main>` 안쪽이라, 뒤로 왔을 때 위치 복원도 직접 합니다
 * (`useScrollRestoration`).
 */
export function AppShell() {
    const mainRef = useRef<HTMLElement>(null);
    useScrollRestoration(mainRef);

    return (
        <div className="flex h-screen overflow-hidden bg-brand-canvas">
            {/*
             * 본문 바로가기.
             *
             * 사이드바 메뉴 6개와 헤더가 매 화면 앞에 있어서, 키보드로는 **Tab 을 8번**
             * 눌러야 본문에 닿았습니다. 화면을 옮길 때마다 그 8번을 다시 밟습니다.
             * 목록에서 상세로, 다시 목록으로 오가는 화면이라 금방 쌓입니다.
             *
             * 평소엔 화면 밖에 숨어 있다가 포커스를 받으면 나타납니다 — 마우스 사용자에게는
             * 보이지 않고, Tab 을 처음 누른 사람에게만 보입니다.
             *
             * `<main>` 은 `tabIndex={-1}` 이라야 `#main` 으로 이동했을 때 포커스가 실제로
             * 옮겨집니다. 없으면 주소만 바뀌고 다음 Tab 은 여전히 사이드바로 갑니다.
             */}
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[7px] focus:bg-brand-blue focus:px-4 focus:py-2 focus:text-[13px] focus:font-bold focus:text-white"
            >
                본문 바로가기
            </a>
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <AppHeader />
                <main
                    id="main"
                    tabIndex={-1}
                    ref={mainRef}
                    className="min-h-0 flex-1 overflow-auto px-9 pb-9 pt-8 focus-visible:outline-none"
                >
                    {/*
                     * 최소 폭 보장.
                     *
                     * 표 열이 시안 좌표대로 고정 px 라, 창이 좁아지면 컨테이너보다 넓어지는데
                     * 표 카드의 `overflow-hidden`(둥근 모서리용)이 그걸 **잘라 냈습니다.**
                     * 1100px 에서는 상태 배지가 반쯤 썰리고 '상세' 열이 아예 사라졌고,
                     * 스크롤로 꺼내 볼 수도 없었습니다.
                     *
                     * 그래서 열을 접거나 숨기지 않고 **최소 폭을 준 뒤 가로 스크롤**로 넘깁니다.
                     * 관리자 화면은 값을 나란히 놓고 대조하는 게 목적이라, 열이 사라지면
                     * 좁아도 쓸 수 있는 게 아니라 아예 못 쓰게 됩니다.
                     *
                     * 956px = 시안 기준 폭에서 사이드바(252)와 좌우 여백(36×2)을 뺀 값입니다.
                     * 즉 1280px 이상에서는 지금과 똑같이 보이고, 그 아래에서만 스크롤이 생깁니다.
                     */}
                    <div className="min-w-[956px]">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
