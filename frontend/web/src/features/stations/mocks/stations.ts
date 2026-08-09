import { SEED_SLOTS, SEED_STATION, SEED_SYNCED_AT } from '@/features/stations/mocks/ec2Seed';
import { EXTRA_STATIONS } from '@/features/stations/mocks/extraStations';
import { buildSlots } from '@/features/stations/mocks/slots';
import { deriveSlotDisplayStatus, type Station } from '@/features/stations/types';

/**
 * 대여소 목업 데이터.
 *
 * 신원은 `stationId`(UUID)뿐입니다. ERD v3.0 이 `station_code`·`location_text` 를 P0 필수
 * 컬럼에서 뺐어서 표시도 `name` 으로만 합니다.
 *
 * **두 갈래를 섞습니다.**
 *   1. 「정문 대여소」 — `ec2Seed.ts`. 실서버에 실재하는 대여소를 값 그대로 옮긴 것입니다.
 *   2. 가상 대여소 8곳 — `extraStations.ts`. 서버에 **없습니다.**
 *
 * 한때 1번만 남긴 적이 있습니다. "실 API 로 스위치를 내려도 화면이 그대로여야 한다"는
 * 이유였는데, 그러면 목록도 지도도 한 줄짜리라 레이아웃·집계·페이지네이션을 개발 중에
 * 확인할 수가 없습니다. 목업의 일은 실제를 흉내 내는 것보다 **화면을 굴려 보는 것**이라
 * 판단해 되살렸습니다 (PM 요청, 2026-08-09).
 *
 * ⚠️ 그래서 **목업과 실 API 는 대여소 개수가 다릅니다.** 목업에서 9곳이 보이다가 실
 * 모드에서 1곳이 되는 건 정상입니다. 실서버에 대여소가 하나뿐이기 때문입니다.
 *
 * 재고 집계(available·damaged·adminReview)는 **손으로 적지 않고 슬롯에서 셉니다.**
 * 예전에는 두 곳을 따로 관리해서 화면끼리 숫자가 어긋날 수 있었습니다.
 *
 * TODO: 대여소 목록 API 가 계약에 들어오면 이 파일을 지우세요.
 */

/**
 * 집계 없이 설정만 담은 대여소. 슬롯 생성의 입력값입니다.
 *
 * 시드 대여소의 `slotCount` 는 지어내지 않고 시드 슬롯 개수를 셉니다. 두 곳에 적으면
 * 어긋납니다. 첫 자리에 두어 목록 맨 위에 실재하는 대여소가 오게 합니다.
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
    ...EXTRA_STATIONS,
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
