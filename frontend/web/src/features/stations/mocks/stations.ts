import type { Station } from '@/features/stations/types';

/**
 * 대여소 목업 데이터 (시안 값 그대로).
 *
 * 대시보드 분포도/재고 순위와 대여소 목록이 같은 값을 봐야 해서 한 곳에 둡니다.
 * TODO: GET /admin/stations 연동 후 이 파일을 지우고 TanStack Query 로 교체하세요.
 */
export const MOCK_STATIONS: Station[] = [
    {
        id: 'ST-001',
        name: '정문 광장',
        available: 28,
        capacity: 40,
        damaged: 0,
        adminReview: 0,
        online: true,
        position: { x: 20.1, y: 86.0 },
    },
    {
        id: 'ST-002',
        name: '중앙도서관',
        available: 41,
        capacity: 56,
        damaged: 1,
        adminReview: 2,
        online: true,
        position: { x: 46.8, y: 30.2 },
    },
    {
        id: 'ST-003',
        name: '제1공학관',
        available: 12,
        capacity: 40,
        damaged: 1,
        adminReview: 2,
        online: true,
        position: { x: 79.9, y: 38.6 },
    },
    {
        id: 'ST-005',
        name: '경영관',
        available: 22,
        capacity: 40,
        damaged: 2,
        adminReview: 1,
        online: true,
        position: { x: 28.2, y: 51.6 },
    },
    {
        id: 'ST-006',
        name: '자연과학관',
        available: 26,
        capacity: 40,
        damaged: 0,
        adminReview: 0,
        online: true,
        position: { x: 59.7, y: 56.2 },
    },
    {
        id: 'ST-007',
        name: '생활관 A',
        available: 30,
        capacity: 44,
        damaged: 1,
        adminReview: 0,
        online: true,
        position: { x: 82.3, y: 71.5 },
    },
    {
        id: 'ST-008',
        name: '빌리대역 출구',
        available: 48,
        capacity: 60,
        damaged: 2,
        adminReview: 0,
        online: true,
        position: { x: 16.8, y: 20.2 },
    },
    {
        id: 'ST-011',
        name: '대운동장',
        available: 0,
        capacity: 36,
        damaged: 0,
        adminReview: 0,
        online: false,
        position: { x: 50.0, y: 81.5 },
    },
];

export function findStation(id: string | undefined): Station | undefined {
    return MOCK_STATIONS.find((station) => station.id === id);
}

/** 목록 화면 상단에 표시하는 집계 기준 시각 */
export const STATIONS_SYNCED_AT = '2026-07-24 09:20';
