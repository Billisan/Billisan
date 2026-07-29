import { MOCK_NS, mockUuid } from '@/features/stations/mocks/ids';
import { applyOverride } from '@/features/stations/mocks/slotOverrides';
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
 * **슬롯 개수는 대여소의 `slotCount` 하나로 정합니다.** ERD 가 "SLOT 행 수와 Station 설정으로
 * 수량을 결정하고 애플리케이션·DDL에 1 또는 3~5를 상수로 고정하지 않는다"고 했습니다.
 * 그래서 여기에는 개수를 박지 않고 대여소 설정을 그대로 따릅니다. 시연 구성이 바뀌면
 * `mocks/stations.ts` 의 `slotCount` 만 고치면 됩니다.
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
 * 상태를 돌려 가며 배치하는 순환 패턴.
 *
 * 대여소마다 시작 위치가 달라서 같은 구성이 반복되지 않습니다. 개수가 3개든 5개든
 * 20개든 이 패턴으로 채워지므로, 슬롯 수를 바꿔도 코드를 손댈 필요가 없습니다.
 */
const PATTERN: SlotPreset[] = [
    'AVAILABLE',
    'ADMIN_REVIEW',
    'AVAILABLE',
    'DAMAGED',
    'LENT_OUT',
    'AVAILABLE',
    'REVIEWED_NORMAL',
    'EMPTY',
];

const UPDATED_DATE = '2026-07-24';

/** 대여소 순번. UUID 꼬리에서 뽑습니다 — 대여소 목록을 import 하면 순환 참조가 됩니다. */
function stationSeq(station: Station): number {
    return Number(station.stationId.slice(-4)) || 1;
}

function presetOf(station: Station, slotNumber: number): SlotPreset {
    return PATTERN[(stationSeq(station) + slotNumber - 1) % PATTERN.length];
}

/** 슬롯 번호 → 전역 목업 순번. 슬롯·검수 ID 가 대여소끼리 겹치지 않게 자리를 가릅니다. */
export function slotSeq(station: Station, slotNumber: number): number {
    return stationSeq(station) * 100 + slotNumber;
}

/** 이 슬롯에 걸린 검수 상태. 목록 응답에는 없고 상세·검수 API 에서만 씁니다. */
export function inspectionStateOf(
    station: Station,
    slotNumber: number,
): 'PENDING' | 'DECIDED' | null {
    return PRESET[presetOf(station, slotNumber)].inspection;
}

export function buildSlots(station: Station): SlotSummary[] {
    return Array.from({ length: station.slotCount }, (_, index) => {
        const slotNumber = index + 1;
        const shape = PRESET[presetOf(station, slotNumber)];

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
