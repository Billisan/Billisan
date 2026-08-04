import { SEED_SLOTS, SEED_STATION, SEED_SYNCED_AT } from '@/features/stations/mocks/ec2Seed';
import { buildSlots } from '@/features/stations/mocks/slots';
import { deriveSlotDisplayStatus, type Station } from '@/features/stations/types';

/**
 * 대여소 목업 데이터 — **EC2 시드 그대로입니다** (`mocks/ec2Seed.ts`).
 *
 * 신원은 `stationId`(UUID)뿐입니다. ERD v3.0 이 `station_code`·`location_text` 를 P0 필수
 * 컬럼에서 뺐어서 표시도 `name` 으로만 합니다.
 *
 * **대여소는 한 곳뿐입니다.** 예전에는 8곳을 지어냈는데, 실 서버에는 「정문 대여소」
 * 하나만 있습니다. 개수를 맞춰 두면 실 API 로 스위치를 내려도 화면이 그대로입니다 —
 * 목록 줄 수도, 지도 위 점 개수도, 대시보드 집계도요. 화면이 휑해 보이는 건 실제가
 * 그렇기 때문이고, 그게 목업이 보여 줘야 하는 모습입니다.
 *
 * 재고 집계(available·damaged·adminReview)는 **손으로 적지 않고 슬롯에서 셉니다.**
 * 예전에는 두 곳을 따로 관리해서 화면끼리 숫자가 어긋날 수 있었습니다.
 *
 * TODO: 대여소 목록 API 가 계약에 들어오면 이 파일을 지우세요.
 */

/**
 * 집계 없이 설정만 담은 대여소. 슬롯 생성의 입력값입니다.
 *
 * `slotCount` 도 지어내지 않고 시드 슬롯 개수를 셉니다. 두 곳에 적으면 어긋납니다.
 */
const CONFIGS: Station[] = [
    {
        stationId: SEED_STATION.stationId,
        name: SEED_STATION.name,
        serviceStatus: SEED_STATION.serviceStatus,
        deviceStatus: SEED_STATION.deviceStatus,
        slotCount: SEED_SLOTS.length,
        position: SEED_STATION.position,
        // 아래는 buildSlots 로 채웁니다. 여기 값은 쓰이지 않습니다.
        available: 0,
        capacity: SEED_SLOTS.length,
        damaged: 0,
        adminReview: 0,
        unknownOccupancy: 0,
    },
];

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
    let unknownOccupancy = 0;

    for (const slot of slots) {
        const display = deriveSlotDisplayStatus(slot);
        if (display === 'AVAILABLE') available += 1;
        if (display === 'DAMAGED') damaged += 1;
        if (display === 'ADMIN_REVIEW') adminReview += 1;
        // 파생 배지가 아니라 점유 축 원값을 셉니다 — 실 API 의 `unknownOccupancySlotCount` 와 같은 기준.
        if (slot.occupancyStatus === 'UNKNOWN') unknownOccupancy += 1;
    }

    return {
        ...station,
        capacity: slots.length,
        available,
        damaged,
        adminReview,
        unknownOccupancy,
    };
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
export const STATIONS_SYNCED_AT = SEED_SYNCED_AT;
