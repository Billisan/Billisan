import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { LegacySlotRedirect } from '@/app/LegacySlotRedirect';
import { NotFoundPage } from '@/app/NotFoundPage';
import { ProtectedRoute } from '@/app/ProtectedRoute';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { RentalDetailPage } from '@/features/history/pages/RentalDetailPage';
import { InspectionDetailPage } from '@/features/inspections/pages/InspectionDetailPage';
import { InspectionListPage } from '@/features/inspections/pages/InspectionListPage';
import { RentalListPage } from '@/features/history/pages/RentalListPage';
import { ReturnDetailPage } from '@/features/history/pages/ReturnDetailPage';
import { ReturnListPage } from '@/features/history/pages/ReturnListPage';
import { SettlementDetailPage } from '@/features/history/pages/SettlementDetailPage';
import { SettlementListPage } from '@/features/history/pages/SettlementListPage';
import { InventoryPage } from '@/features/inventory/pages/InventoryPage';
import { MapPage } from '@/features/map/pages/MapPage';
import { UserHistoryPage } from '@/features/users/pages/UserHistoryPage';
import { SlotDetailPage } from '@/features/stations/pages/SlotDetailPage';
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
                    /*
                     * 슬롯 상세는 대여소 아래 중첩하지 않습니다.
                     *
                     * 화면흐름 §4 의 라우팅 후보가 `/admin/slots/:slotId` 로 평면이고,
                     * `ADMIN-SLOT-DETAIL-001 GET /slots/{slotId}` 도 슬롯 ID 하나만 받으며
                     * 응답에 `stationId` 가 들어 있습니다. 주소에 대여소 ID 를 또 넣으면
                     * 길어지기만 하는 게 아니라, 주소의 대여소와 슬롯의 실제 소속이 어긋났을 때
                     * 다른 대여소 이름·코드로 표시되는 문제가 생깁니다.
                     */
                    { path: 'slots/:slotId', element: <SlotDetailPage /> },
                    /*
                     * 옛 중첩 주소로 들어오면 새 주소로 넘깁니다.
                     *
                     * 열어 둔 탭·북마크·주고받은 링크가 갑자기 404 로 죽지 않게 하는 장치입니다.
                     * `replace` 라 뒤로가기 기록에 옛 주소가 남지 않습니다.
                     */
                    { path: 'stations/:stationId/slots/:slotId', element: <LegacySlotRedirect /> },

                    {
                        path: 'umbrellas',
                        element: <InventoryPage />,
                    },
                    // 이력 3종 — 화면흐름 §4 의 `/admin/history/*` 경로 후보를 따릅니다.
                    // 전부 P1 이라 확정 API 가 없습니다 (WEB-API-CAND-002~007).
                    { path: 'history', element: <Navigate to="/history/rentals" replace /> },
                    { path: 'history/rentals', element: <RentalListPage /> },
                    { path: 'history/rentals/:rentalId', element: <RentalDetailPage /> },
                    { path: 'history/returns', element: <ReturnListPage /> },
                    {
                        path: 'history/returns/:returnAttemptId',
                        element: <ReturnDetailPage />,
                    },
                    { path: 'history/settlements', element: <SettlementListPage /> },
                    {
                        path: 'history/settlements/:settlementId',
                        element: <SettlementDetailPage />,
                    },
                    { path: 'users/:userRef/history', element: <UserHistoryPage /> },
                    // 파손 검수 2종 — P0 계약(ADMIN-INSPECTION-001~003)이 있는 화면입니다.
                    { path: 'inspections', element: <InspectionListPage /> },
                    { path: 'inspections/:inspectionId', element: <InspectionDetailPage /> },
                    /*
                     * 지도·분포도 — `SCR-WEB-MAP-001`.
                     *
                     * 좌표 출처가 없어 실제 지도 SDK 는 못 붙입니다. ERD `STATION` 컬럼은
                     * `station_id`·`name`·`service_status`·`device_status`·
                     * `current_boot_id`·`boot_synced_at`·`last_seen_at` 뿐이고 위도·경도가
                     * 없습니다. 그래서 캠퍼스 배치를 도식으로 그리고 마커를 백분율 좌표에
                     * 놓습니다 — 실제 지도 위에 목업 좌표를 찍으면 맞는 위치처럼 보이는데
                     * 그건 근거가 없습니다.
                     *
                     * 좌표 컬럼이 생기면 `MapBackdrop` 만 SDK 로 갈아 끼우면 됩니다.
                     */
                    { path: 'map', element: <MapPage /> },
                    /*
                     * `settlements` 는 지웠습니다.
                     *
                     * 사이드바에 없고, 대시보드 바로가기 하나만 이 빈 자리 화면을 가리켰습니다.
                     * 그 바로가기는 이미 있는 정산 이력(`/history/settlements?status=PENDING`)
                     * 으로 돌렸습니다 — 관리자가 하려던 일은 거기서 됩니다.
                     *
                     * 정산 관리 화면 자체는 `WEB-API-CAND-005 · P1` 미계약이고 화면흐름
                     * §11.2 의 수동 처리도 `DEFERRED_NOT_CONTRACTED` 입니다. 빈 자리를
                     * 남겨 두면 "있는데 아직 안 만든 것"처럼 보여서, 계약이 정해질 때
                     * 화면과 함께 되살리는 쪽이 맞습니다. 주소로 들어오면 404 입니다.
                     */
                ],
            },
        ],
    },
    {
        path: '*',
        element: <NotFoundPage />,
    },
]);
