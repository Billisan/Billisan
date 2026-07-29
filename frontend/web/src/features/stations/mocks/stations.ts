import { MOCK_NS, mockUuid } from '@/features/stations/mocks/ids';
import type { Station } from '@/features/stations/types';

/**
 * 대여소 목업 데이터 (시안 값 그대로).
 *
 * 대시보드 분포도/재고 순위와 대여소 목록이 같은 값을 봐야 해서 한 곳에 둡니다.
 * TODO: ADMIN-INVENTORY-001 연동 후 이 파일을 지우고 TanStack Query 로 교체하세요.
 *
 * 신원은 `stationId`(UUID)입니다. 'ST-003' 은 ERD `station_code` 로, 화면 표시용입니다.
 */

/**
 * 집계는 `mocks/slots.ts` 의 LAYOUTS 와 손으로 맞춘 값입니다.
 * 상위 기획 §4.1 이 대여소당 3~5 SLOT 을 못 박아서 슬롯 수가 작습니다.
 */
interface StationSeed {
    /** `station_code` */
    code: string;
    name: string;
    /** `location_text` — 좌표가 아니라 자유 텍스트입니다 */
    locationText: string;
    available: number;
    capacity: number;
    damaged: number;
    adminReview: number;
    deviceStatus: Station['deviceStatus'];
    serviceStatus: Station['serviceStatus'];
    position: { x: number; y: number };
}

const SEEDS: StationSeed[] = [
    {
        code: 'ST-001',
        name: '정문 광장',
        locationText: '정문 광장 버스정류장 옆',
        available: 2,
        capacity: 3,
        damaged: 0,
        adminReview: 0,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 20.1, y: 86.0 },
    },
    {
        code: 'ST-002',
        name: '중앙도서관',
        locationText: '중앙도서관 1층 출입구',
        available: 2,
        capacity: 4,
        damaged: 0,
        adminReview: 1,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 46.8, y: 30.2 },
    },
    {
        code: 'ST-003',
        name: '제1공학관',
        locationText: '제1공학관 로비',
        available: 2,
        capacity: 5,
        damaged: 1,
        adminReview: 1,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 79.9, y: 38.6 },
    },
    {
        code: 'ST-005',
        name: '경영관',
        locationText: '경영관 후문',
        available: 3,
        capacity: 4,
        damaged: 1,
        adminReview: 0,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 28.2, y: 51.6 },
    },
    {
        code: 'ST-006',
        name: '자연과학관',
        locationText: '자연과학관 중앙 계단',
        available: 2,
        capacity: 3,
        damaged: 0,
        adminReview: 0,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 59.7, y: 56.2 },
    },
    {
        code: 'ST-007',
        name: '생활관 A',
        locationText: '생활관 A동 1층',
        available: 3,
        capacity: 4,
        damaged: 1,
        adminReview: 0,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 82.3, y: 71.5 },
    },
    {
        code: 'ST-008',
        name: '빌리대역 출구',
        locationText: '빌리대역 2번 출구',
        available: 2,
        capacity: 5,
        damaged: 0,
        adminReview: 1,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 16.8, y: 20.2 },
    },
    {
        code: 'ST-011',
        name: '대운동장',
        locationText: '대운동장 관중석 입구',
        available: 0,
        capacity: 3,
        damaged: 0,
        adminReview: 0,
        // 장치가 끊긴 대여소. `ERROR` 와 구분되는 상태입니다.
        deviceStatus: 'OFFLINE',
        serviceStatus: 'MAINTENANCE',
        position: { x: 50.0, y: 81.5 },
    },
];

export const MOCK_STATIONS: Station[] = SEEDS.map((seed, index) => ({
    stationId: mockUuid(MOCK_NS.station, index + 1),
    stationCode: seed.code,
    name: seed.name,
    locationText: seed.locationText,
    serviceStatus: seed.serviceStatus,
    deviceStatus: seed.deviceStatus,
    available: seed.available,
    capacity: seed.capacity,
    damaged: seed.damaged,
    adminReview: seed.adminReview,
    position: seed.position,
}));

/** 라우트 파라미터(UUID)로 찾습니다. */
export function findStation(stationId: string | undefined): Station | undefined {
    return MOCK_STATIONS.find((station) => station.stationId === stationId);
}

/** 표시 코드('ST-003')로 찾습니다. 링크를 만들 때만 쓰세요. */
export function findStationByCode(code: string): Station | undefined {
    return MOCK_STATIONS.find((station) => station.stationCode === code);
}

/** 목록 화면 상단에 표시하는 집계 기준 시각 */
export const STATIONS_SYNCED_AT = '2026-07-24 09:20';
