import { MOCK_NS, mockUuid } from '@/features/stations/mocks/ids';
import { applyOverride } from '@/features/stations/mocks/slotOverrides';
import { MOCK_STATIONS } from '@/features/stations/mocks/stations';
import type {
    LockStatus,
    SlotItemCondition,
    SlotOccupancyStatus,
    SlotServiceStatus,
    SlotSummary,
    Station,
} from '@/features/stations/types';

/**
 * 슬롯 목업 생성기 — `ADMIN-SLOT-001` 의 `items[]` 모양을 만듭니다.
 *
 * 응답에 있는 필드만 만듭니다: `slotId, slotNumber, occupancyStatus, itemCondition,
 * serviceStatus, lockStatus, updatedAt`. 활성 대여도 검수 요약도 목록에는 없습니다.
 *
 * TODO: ADMIN-SLOT-001 연동 시 이 파일을 지우세요.
 */

/** 시안이 보여주는 상태 조합 묶음. 실제 저장 값은 아래 PRESET 의 4축입니다. */
type SlotPreset =
    | 'AVAILABLE'
    /** AI 는 파손을 의심했지만 관리자가 이상 없음으로 뒤집은 슬롯. 표시 상태는 AVAILABLE 과 같습니다. */
    | 'REVIEWED_NORMAL'
    /** 우산이 나가 있는 슬롯. 관리자 API 로는 '대여 중'을 알 수 없어 빈 슬롯으로 보입니다. */
    | 'LENT_OUT'
    | 'EMPTY'
    | 'DAMAGED'
    | 'ADMIN_REVIEW';

interface PresetShape {
    occupancyStatus: SlotOccupancyStatus;
    serviceStatus: SlotServiceStatus;
    /** 점유가 EMPTY 면 null 입니다 (12-R B-4) */
    itemCondition: SlotItemCondition | null;
    lockStatus: LockStatus;
    inspection: 'PENDING' | 'DECIDED' | null;
    /** 'HH:mm' — 시안 값 */
    time: string;
}

/**
 * 4축 조합은 `ADMIN-SLOT-STATUS-001` 허용 조합과 `ADMIN-INSPECTION-003` 판정 결과를 따릅니다.
 * - DAMAGED 판정 → OUT_OF_SERVICE + DAMAGED
 * - KEEP_ADMIN_REVIEW → 검수 PENDING + ADMIN_REVIEW
 */
const PRESET: Record<SlotPreset, PresetShape> = {
    AVAILABLE: {
        occupancyStatus: 'OCCUPIED',
        serviceStatus: 'AVAILABLE',
        itemCondition: 'NORMAL',
        lockStatus: 'LOCKED',
        inspection: null,
        time: '09:19',
    },
    /**
     * AI 오탐 케이스.
     *
     * 4축은 AVAILABLE 과 같지만 검수가 DECIDED 로 남아 있어, 슬롯 상세에서
     * `AI 판정 DAMAGED` 와 `관리자 최종 판정 NORMAL` 이 서로 다르게 보입니다.
     */
    REVIEWED_NORMAL: {
        occupancyStatus: 'OCCUPIED',
        serviceStatus: 'AVAILABLE',
        itemCondition: 'NORMAL',
        lockStatus: 'LOCKED',
        inspection: 'DECIDED',
        time: '08:47',
    },
    LENT_OUT: {
        occupancyStatus: 'EMPTY',
        serviceStatus: 'AVAILABLE',
        itemCondition: null,
        lockStatus: 'LOCKED',
        inspection: null,
        time: '08:52',
    },
    EMPTY: {
        occupancyStatus: 'EMPTY',
        serviceStatus: 'AVAILABLE',
        itemCondition: null,
        lockStatus: 'LOCKED',
        inspection: null,
        time: '08:31',
    },
    DAMAGED: {
        occupancyStatus: 'OCCUPIED',
        serviceStatus: 'OUT_OF_SERVICE',
        itemCondition: 'DAMAGED',
        lockStatus: 'LOCKED',
        inspection: 'DECIDED',
        time: '08:40',
    },
    ADMIN_REVIEW: {
        occupancyStatus: 'OCCUPIED',
        serviceStatus: 'ADMIN_REVIEW',
        itemCondition: 'UNKNOWN',
        lockStatus: 'LOCKED',
        inspection: 'PENDING',
        time: '09:12',
    },
};

/**
 * 대여소 하나의 슬롯 구성.
 *
 * 상위 기획 §4.1: "제품·DB·API·화면은 대여소당 3~5 SLOT을 지원하고 실제 시연 장비는 물리 SLOT 1개".
 * 그래서 대여소마다 3~5개만 만듭니다. `ADMIN-SLOT-001` 도 "P0 목록은 소규모 고정 구성으로
 * cursor를 사용하지 않는다"고 못 박았습니다.
 */
const LAYOUTS: SlotPreset[][] = [
    ['AVAILABLE', 'LENT_OUT', 'AVAILABLE'],
    ['AVAILABLE', 'ADMIN_REVIEW', 'AVAILABLE', 'EMPTY'],
    ['AVAILABLE', 'ADMIN_REVIEW', 'DAMAGED', 'LENT_OUT', 'AVAILABLE'],
    ['AVAILABLE', 'DAMAGED', 'REVIEWED_NORMAL', 'AVAILABLE'],
    ['AVAILABLE', 'AVAILABLE', 'EMPTY'],
    ['REVIEWED_NORMAL', 'AVAILABLE', 'DAMAGED', 'AVAILABLE'],
    ['AVAILABLE', 'LENT_OUT', 'AVAILABLE', 'ADMIN_REVIEW', 'EMPTY'],
    ['EMPTY', 'EMPTY', 'EMPTY'],
];

const UPDATED_DATE = '2026-07-24';

/** 대여소 순번. 슬롯·검수 ID 가 전역에서 겹치지 않도록 자리를 가릅니다. */
function stationIndexOf(station: Station): number {
    return MOCK_STATIONS.findIndex((item) => item.stationId === station.stationId);
}

export function slotPresetsOf(station: Station): SlotPreset[] {
    const index = stationIndexOf(station);
    return LAYOUTS[index >= 0 ? index % LAYOUTS.length : 0];
}

/** 슬롯 번호 → 전역 목업 순번 */
export function slotSeq(station: Station, slotNumber: number): number {
    return (stationIndexOf(station) + 1) * 100 + slotNumber;
}

/** 이 슬롯에 걸린 검수 상태. 목록 응답에는 없고 상세·검수 API 에서만 씁니다. */
export function inspectionStateOf(
    station: Station,
    slotNumber: number,
): 'PENDING' | 'DECIDED' | null {
    return PRESET[slotPresetsOf(station)[slotNumber - 1]]?.inspection ?? null;
}

export function buildSlots(station: Station): SlotSummary[] {
    return slotPresetsOf(station).map((preset, index) => {
        const shape = PRESET[preset];
        const slotNumber = index + 1;

        // 관리자가 방금 바꾼 슬롯이면 그 결과로 덮어씁니다. 목업 전용이라 새로고침하면 사라집니다.
        return applyOverride({
            slotId: mockUuid(MOCK_NS.slot, slotSeq(station, slotNumber)),
            slotNumber,
            occupancyStatus: shape.occupancyStatus,
            serviceStatus: shape.serviceStatus,
            itemCondition: shape.itemCondition,
            lockStatus: shape.lockStatus,
            // 서버 계약과 같은 DATETIME(6) 형태로 둡니다. 표시할 때만 잘라 씁니다.
            updatedAt: `${UPDATED_DATE}T${shape.time}:00.000000+09:00`,
        });
    });
}

/** 상세 화면 상단에 표시하는 최근 통신 시각 */
export const STATION_SYNCED_AT = '2026-07-24 09:19';

/**
 * 슬롯 목록 페이지당 행 수.
 *
 * 대여소당 3~5개뿐이라 실제로는 한 쪽에 다 들어옵니다. `ADMIN-SLOT-001` 은 cursor 도
 * 쓰지 않습니다. 값은 남겨 두되 화면에서 페이지네이션은 걷어냈습니다.
 */
export const SLOT_PAGE_SIZE = 10;
