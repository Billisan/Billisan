import { createBrowserRouter } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { NotFoundPage } from '@/app/NotFoundPage';
import { PlaceholderPage } from '@/app/PlaceholderPage';
import { ProtectedRoute } from '@/app/ProtectedRoute';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { StationDetailPage } from '@/features/stations/pages/StationDetailPage';
import { StationListPage } from '@/features/stations/pages/StationListPage';

/**
 * 앱 라우팅 정의.
 * 새 화면은 features/<domain>/pages 에 만들고 여기 children 에 등록하세요.
 * 사이드바 메뉴는 shared/constants/navigation.ts 와 경로를 맞춰야 합니다.
 */
export const router = createBrowserRouter([
    {
        path: '/login',
        element: <LoginPage />,
    },
    {
        element: <ProtectedRoute />,
        children: [
            {
                path: '/',
                element: <AppShell />,
                children: [
                    { index: true, element: <DashboardPage /> },

                    { path: 'stations', element: <StationListPage /> },
                    { path: 'stations/:stationId', element: <StationDetailPage /> },
                    {
                        path: 'stations/:stationId/slots/:slotId',
                        element: <PlaceholderPage title="슬롯 상세" />,
                    },

                    // 아래는 메뉴만 있고 화면은 아직 없는 자리입니다.
                    // 해당 도메인 페이지가 생기면 PlaceholderPage 를 실제 페이지로 교체하세요.
                    {
                        path: 'umbrellas',
                        element: <PlaceholderPage title="우산 재고" />,
                    },
                    { path: 'history', element: <PlaceholderPage title="이력" /> },
                    {
                        path: 'inspections',
                        element: <PlaceholderPage title="파손 검수" />,
                    },
                    { path: 'map', element: <PlaceholderPage title="지도·분포도" /> },
                    { path: 'actions', element: <PlaceholderPage title="조치 이력" /> },
                    {
                        path: 'settlements',
                        element: <PlaceholderPage title="미정산 처리" />,
                    },
                ],
            },
        ],
    },
    {
        path: '*',
        element: <NotFoundPage />,
    },
]);
