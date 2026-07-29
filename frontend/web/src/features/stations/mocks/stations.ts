import { MOCK_NS, mockUuid } from '@/features/stations/mocks/ids';
import { buildSlots } from '@/features/stations/mocks/slots';
import { deriveSlotDisplayStatus, type Station } from '@/features/stations/types';

/**
 * 대여소 목업 데이터.
 *
 * 신원은 `stationId`(UUID)이고 'ST-003' 은 ERD `station_code` 로 화면 표시용입니다.
 *
 * **슬롯 개수는 `slotCount` 하나로 정합니다.** 상위 기획 §4.1 이 "제품·DB·API·화면은
 * 대여소당 3~5 SLOT을 지원"이라고 했고, ERD 는 "SLOT 행 수와 Station 설정으로 수량을
 * 결정하고 애플리케이션·DDL에 1 또는 3~5를 상수로 고정하지 않는다"고 했습니다.
 * 지금 값은 시연 구성일 뿐이고, 바꾸고 싶으면 아래 숫자만 고치면 됩니다.
 *
 * 재고 집계(available·damaged·adminReview)는 **손으로 적지 않고 슬롯에서 셉니다.**
 * 예전에는 두 곳을 따로 관리해서 화면끼리 숫자가 어긋날 수 있었습니다.
 *
 * TODO: 대여소 목록 API 가 계약에 들어오면 이 파일을 지우세요.
 */

interface StationSeed {
    /** `station_code` */
    code: string;
    name: string;
    /** `location_text` — 좌표가 아니라 자유 텍스트입니다 */
    locationText: string;
    /** 이 대여소에 실제로 설치된 SLOT 행 수 */
    slotCount: number;
    deviceStatus: Station['deviceStatus'];
    serviceStatus: Station['serviceStatus'];
    position: { x: number; y: number };
}

const SEEDS: StationSeed[] = [
    {
        code: 'ST-001',
        name: '정문 광장',
        locationText: '정문 광장 버스정류장 옆',
        slotCount: 5,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 20.1, y: 86.0 },
    },
    {
        code: 'ST-002',
        name: '중앙도서관',
        locationText: '중앙도서관 1층 출입구',
        slotCount: 5,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 46.8, y: 30.2 },
    },
    {
        code: 'ST-003',
        name: '제1공학관',
        locationText: '제1공학관 로비',
        slotCount: 5,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 79.9, y: 38.6 },
    },
    {
        code: 'ST-005',
        name: '경영관',
        locationText: '경영관 후문',
        slotCount: 4,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 28.2, y: 51.6 },
    },
    {
        code: 'ST-006',
        name: '자연과학관',
        locationText: '자연과학관 중앙 계단',
        slotCount: 4,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 59.7, y: 56.2 },
    },
    {
        code: 'ST-007',
        name: '생활관 A',
        locationText: '생활관 A동 1층',
        slotCount: 5,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 82.3, y: 71.5 },
    },
    {
        code: 'ST-008',
        name: '빌리대역 출구',
        locationText: '빌리대역 2번 출구',
        slotCount: 5,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 16.8, y: 20.2 },
    },
    {
        code: 'ST-011',
        name: '대운동장',
        locationText: '대운동장 관중석 입구',
        slotCount: 3,
        // 장치가 끊긴 대여소. `ERROR` 와 구분되는 상태입니다.
        deviceStatus: 'OFFLINE',
        serviceStatus: 'MAINTENANCE',
        position: { x: 50.0, y: 81.5 },
    },
];

/** 집계 없이 설정만 담은 대여소. 슬롯 생성의 입력값입니다. */
const CONFIGS: Station[] = SEEDS.map((seed, index) => ({
    stationId: mockUuid(MOCK_NS.station, index + 1),
    stationCode: seed.code,
    name: seed.name,
    locationText: seed.locationText,
    serviceStatus: seed.serviceStatus,
    deviceStatus: seed.deviceStatus,
    slotCount: seed.slotCount,
    position: seed.position,
    // 아래는 buildSlots 로 채웁니다. 여기 값은 쓰이지 않습니다.
    available: 0,
    capacity: seed.slotCount,
    damaged: 0,
    adminReview: 0,
}));

/**
 * 슬롯을 세어 집계를 채운 대여소.
 *
 * 매번 다시 셉니다. 관리자가 슬롯 상태를 바꾸면 대시보드·목록 숫자도 따라 움직여야 합니다.
 */
export function stationWithStock(station: Station): Station {
    const slots = buildSlots(station);
    let available = 0;
    let damaged = 0;
    let adminReview = 0;

    for (const slot of slots) {
        const display = deriveSlotDisplayStatus(slot);
        if (display === 'AVAILABLE') available += 1;
        if (display === 'DAMAGED') damaged += 1;
        if (display === 'ADMIN_REVIEW') adminReview += 1;
    }

    return { ...station, capacity: slots.length, available, damaged, adminReview };
}

/** 집계까지 채운 전체 목록. 화면은 `stationsApi` 를 거쳐 이 값을 받습니다. */
export const MOCK_STATIONS: Station[] = CONFIGS.map(stationWithStock);

/** 라우트 파라미터(UUID)로 찾습니다. 집계는 호출 시점 기준으로 다시 셉니다. */
export function findStation(stationId: string | undefined): Station | undefined {
    const config = CONFIGS.find((station) => station.stationId === stationId);
    return config && stationWithStock(config);
}

/** 집계를 다시 센 전체 목록. 슬롯 상태가 바뀐 뒤 조회하면 새 숫자가 나옵니다. */
export function listStations(): Station[] {
    return CONFIGS.map(stationWithStock);
}

/** 목록 화면 상단에 표시하는 집계 기준 시각 */
export const STATIONS_SYNCED_AT = '2026-07-24 09:20';
