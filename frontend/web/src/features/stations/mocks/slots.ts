import { isSlotLocked, type Slot, type SlotStatus, type Station } from '@/features/stations/types';

/**
 * 슬롯 목업 생성기.
 *
 * 대여소 목록의 집계(사용 가능 / 파손 / 관리자 확인)와 슬롯 상태 개수가 어긋나면
 * 화면끼리 숫자가 안 맞아 보이므로, 집계를 그대로 풀로 만들어 소진하는 방식으로 만듭니다.
 * TODO: GET /admin/stations/:id/slots 연동 시 이 파일을 지우세요.
 */

/** 시안 1페이지에 나온 슬롯 상태 배치 순서 */
const FIRST_PAGE_ORDER: SlotStatus[] = [
    'AVAILABLE',
    'AVAILABLE',
    'RENTED',
    'AVAILABLE',
    'EMPTY',
    'DAMAGED',
    'ADMIN_REVIEW',
    'AVAILABLE',
];

/** 2페이지부터 남은 슬롯을 번갈아 채울 때의 순서 */
const FILL_ORDER: SlotStatus[] = ['RENTED', 'AVAILABLE', 'EMPTY', 'DAMAGED', 'ADMIN_REVIEW'];

/** 상태별 최근 갱신 시각 (시안 값) */
const UPDATED_TIME: Record<SlotStatus, string> = {
    AVAILABLE: '09:19',
    RENTED: '08:52',
    EMPTY: '08:31',
    DAMAGED: '08:40',
    ADMIN_REVIEW: '09:12',
};

const UPDATED_DATE = '07-24';

function buildStatuses(station: Station): SlotStatus[] {
    const rest = station.capacity - station.available - station.damaged - station.adminReview;
    const empty = Math.max(0, Math.floor(rest / 4));

    const pool = new Map<SlotStatus, number>([
        ['AVAILABLE', station.available],
        ['DAMAGED', station.damaged],
        ['ADMIN_REVIEW', station.adminReview],
        ['EMPTY', empty],
        ['RENTED', Math.max(0, rest - empty)],
    ]);

    const take = (status: SlotStatus): boolean => {
        const left = pool.get(status) ?? 0;
        if (left <= 0) return false;
        pool.set(status, left - 1);
        return true;
    };

    const statuses: SlotStatus[] = [];

    // 1) 1페이지는 시안 순서를 그대로 재현합니다.
    for (const status of FIRST_PAGE_ORDER) {
        if (statuses.length >= station.capacity) break;
        if (take(status)) statuses.push(status);
    }

    // 2) 나머지는 상태를 번갈아 배치해 한 상태가 몰려 보이지 않게 채웁니다.
    while (statuses.length < station.capacity) {
        let added = false;
        for (const status of FILL_ORDER) {
            if (statuses.length >= station.capacity) break;
            if (take(status)) {
                statuses.push(status);
                added = true;
            }
        }
        if (!added) break;
    }

    return statuses;
}

export function buildSlots(station: Station): Slot[] {
    const seq = station.id.slice(-2);

    return buildStatuses(station).map((status, index) => ({
        id: `SL-${seq}-${String(index + 1).padStart(2, '0')}`,
        status,
        locked: isSlotLocked(status),
        online: station.online,
        updatedAt: `${UPDATED_DATE} ${UPDATED_TIME[status]}`,
    }));
}

/** 상세 화면 상단에 표시하는 최근 통신 시각 */
export const STATION_SYNCED_AT = '2026-07-24 09:19';

/** 슬롯 목록 페이지당 행 수 */
export const SLOT_PAGE_SIZE = 8;
