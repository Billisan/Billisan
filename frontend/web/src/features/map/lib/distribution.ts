import {
    getStationStatus,
    STOCK_RATIO_THRESHOLD,
    stockRatio,
    type Station,
    type StationStatus,
} from '@/features/stations/types';

/**
 * 지도·분포도의 파생 계산 — `SCR-WEB-MAP-001` (화면흐름 §13).
 *
 * 여기 값은 전부 **조회 시 계산**되는 것이고 저장하지 않습니다.
 *
 * 재배치 추천(`ACT-WEB-MAP-002`)은 아직 넣지 않았습니다. 계산 자체는 가능하지만
 * 옮길 개수를 정하는 기준(수요 예측·운영 정책)이 확정되지 않았고, 등록 API 도
 * 계약에 없습니다(§13: `OUT_OF_SCOPE` 또는 `DEFERRED_NOT_CONTRACTED`). 근거 없는
 * 숫자를 "추천"으로 내보내면 그대로 실행될 수 있어서 기준이 정해진 뒤에 붙입니다.
 */

/** 상태별 개수. 범례 옆에 붙습니다. */
export type StatusTally = Record<StationStatus, number>;

export function tallyByStatus(stations: readonly Station[]): StatusTally {
    const tally: StatusTally = { SHORTAGE: 0, NORMAL: 0, SURPLUS: 0, OFFLINE: 0 };
    for (const station of stations) tally[getStationStatus(station)] += 1;
    return tally;
}

/**
 * 「적정」의 아래 끝에 해당하는 개수.
 *
 * 비율 임계값을 개수로 되돌린 값입니다. 보충은 개수로 하므로 어딘가에서 한 번은 정수로
 * 바꿔야 합니다. 올림을 쓰는 이유: 슬롯 5개의 1/3 은 1.67 인데 1개만 채우면 비율이
 * 20% 라 여전히 「부족」입니다. 2개를 채워야 40% 로 적정에 들어갑니다.
 */
export function normalFloor(capacity: number): number {
    return Math.ceil(capacity * STOCK_RATIO_THRESHOLD.normal);
}

/**
 * 적정선까지 모자란 개수. 적정 이상이면 0 입니다.
 *
 * "몇 개를 채워야 하는가"에 답합니다. 상태 색은 부족하다는 것만 알려주고 얼마나
 * 부족한지는 말해 주지 않습니다.
 */
export function deficit(station: Station): number {
    return Math.max(0, normalFloor(station.capacity) - station.available);
}

/** 화면에 쓰는 채움 비율 문구. 소수점을 버려 표를 가지런히 둡니다. */
export function formatStockRatio(station: Station): string {
    return `${Math.round(stockRatio(station) * 100)}%`;
}
