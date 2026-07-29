import { MOCK_NS, mockUuid } from '@/features/stations/mocks/ids';
import { applyOverride } from '@/features/stations/mocks/slotOverrides';
import { MOCK_STATIONS } from '@/features/stations/mocks/stations';
import type {
    LockStatus,
    Slot,
    SlotInspection,
    SlotItemCondition,
    SlotOccupancyStatus,
    SlotServiceStatus,
    Station,
} from '@/features/stations/types';

/**
 * 슬롯 목업 생성기.
 *
 * 대여소 목록의 집계(사용 가능 / 파손 / 관리자 확인)와 슬롯 상태 개수가 어긋나면
 * 화면끼리 숫자가 안 맞아 보이므로, 집계를 그대로 풀로 만들어 소진하는 방식으로 만듭니다.
 * TODO: ADMIN-SLOT-001 (GET /api/v1/admin/stations/{stationId}/slots) 연동 시 이 파일을 지우세요.
 */

/** 시안이 보여주는 상태 조합 묶음. 실제 저장 값은 아래 PRESET 의 4축입니다. */
type SlotPreset =
    | 'AVAILABLE'
    /** AI 는 파손을 의심했지만 관리자가 이상 없음으로 뒤집은 슬롯. 표시 상태는 AVAILABLE 과 같습니다. */
    | 'REVIEWED_NORMAL'
    | 'RENTED'
    | 'EMPTY'
    | 'DAMAGED'
    | 'ADMIN_REVIEW';

interface PresetShape {
    occupancyStatus: SlotOccupancyStatus;
    serviceStatus: SlotServiceStatus;
    itemCondition: SlotItemCondition | null;
    lockStatus: LockStatus;
    /** 활성 대여가 걸린 슬롯인지 */
    rented: boolean;
    inspection: SlotInspection['reviewStatus'] | null;
    /** 'HH:mm' — 시안 값 */
    time: string;
}

/**
 * 4축 조합은 ADMIN-SLOT-STATUS-001 이 허용하는 조합(어긋나면 INVALID_SLOT_STATE_TRANSITION)과
 * ADMIN-INSPECTION-003 의 판정 결과를 따릅니다.
 * - DAMAGED 판정 → OUT_OF_SERVICE + DAMAGED
 * - KEEP_ADMIN_REVIEW → 검수 PENDING + ADMIN_REVIEW
 */
const PRESET: Record<SlotPreset, PresetShape> = {
    AVAILABLE: {
        occupancyStatus: 'OCCUPIED',
        serviceStatus: 'AVAILABLE',
        itemCondition: 'NORMAL',
        lockStatus: 'LOCKED',
        rented: false,
        inspection: null,
        time: '09:19',
    },
    /**
     * AI 오탐 케이스.
     *
     * 4축은 AVAILABLE 과 같지만 검수가 DECIDED 로 남아 있어, 슬롯 상세에서
     * `AI 판정 DAMAGED` 와 `관리자 최종 판정 NORMAL` 이 서로 다르게 보입니다.
     * 화면흐름 §17 이 "AI 는 보조 결과, 관리자 판정과 최종 슬롯 상태는 별도"라고 한 그 상황입니다.
     */
    REVIEWED_NORMAL: {
        occupancyStatus: 'OCCUPIED',
        serviceStatus: 'AVAILABLE',
        itemCondition: 'NORMAL',
        lockStatus: 'LOCKED',
        rented: false,
        inspection: 'DECIDED',
        time: '08:47',
    },
    RENTED: {
        occupancyStatus: 'EMPTY',
        serviceStatus: 'AVAILABLE',
        itemCondition: null,
        lockStatus: 'UNLOCKED',
        rented: true,
        inspection: null,
        time: '08:52',
    },
    EMPTY: {
        occupancyStatus: 'EMPTY',
        serviceStatus: 'AVAILABLE',
        itemCondition: null,
        lockStatus: 'UNLOCKED',
        rented: false,
        inspection: null,
        time: '08:31',
    },
    DAMAGED: {
        occupancyStatus: 'OCCUPIED',
        serviceStatus: 'OUT_OF_SERVICE',
        itemCondition: 'DAMAGED',
        lockStatus: 'LOCKED',
        rented: false,
        inspection: 'DECIDED',
        time: '08:40',
    },
    ADMIN_REVIEW: {
        occupancyStatus: 'OCCUPIED',
        serviceStatus: 'ADMIN_REVIEW',
        itemCondition: 'UNKNOWN',
        lockStatus: 'LOCKED',
        rented: false,
        inspection: 'PENDING',
        time: '09:12',
    },
};

/** 시안 1페이지에 나온 슬롯 배치 순서 */
const FIRST_PAGE_ORDER: SlotPreset[] = [
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
const FILL_ORDER: SlotPreset[] = [
    'REVIEWED_NORMAL',
    'RENTED',
    'AVAILABLE',
    'EMPTY',
    'DAMAGED',
    'ADMIN_REVIEW',
];

const UPDATED_DATE = '2026-07-24';

function buildPresets(station: Station): SlotPreset[] {
    const rest = station.capacity - station.available - station.damaged - station.adminReview;
    const empty = Math.max(0, Math.floor(rest / 4));

    // AI 오탐 슬롯도 표시는 '사용 가능'이라 available 집계에서 한 칸만 떼어 씁니다.
    const reviewedNormal = station.available > 0 ? 1 : 0;

    const pool = new Map<SlotPreset, number>([
        ['REVIEWED_NORMAL', reviewedNormal],
        ['AVAILABLE', station.available - reviewedNormal],
        ['DAMAGED', station.damaged],
        ['ADMIN_REVIEW', station.adminReview],
        ['EMPTY', empty],
        ['RENTED', Math.max(0, rest - empty)],
    ]);

    const take = (preset: SlotPreset): boolean => {
        const left = pool.get(preset) ?? 0;
        if (left <= 0) return false;
        pool.set(preset, left - 1);
        return true;
    };

    const presets: SlotPreset[] = [];

    // 1) 1페이지는 시안 순서를 그대로 재현합니다.
    for (const preset of FIRST_PAGE_ORDER) {
        if (presets.length >= station.capacity) break;
        if (take(preset)) presets.push(preset);
    }

    // 2) 나머지는 상태를 번갈아 배치해 한 상태가 몰려 보이지 않게 채웁니다.
    while (presets.length < station.capacity) {
        let added = false;
        for (const preset of FILL_ORDER) {
            if (presets.length >= station.capacity) break;
            if (take(preset)) {
                presets.push(preset);
                added = true;
            }
        }
        if (!added) break;
    }

    return presets;
}

/**
 * 슬롯·검수 ID 는 전역에서 겹치면 안 됩니다 (검수 목록이 전 대여소를 한 줄로 폅니다).
 * 대여소 순번 × 100 + 슬롯 번호로 자리를 갈라 둡니다.
 */
function seqOf(station: Station, slotNumber: number): number {
    const stationIndex = MOCK_STATIONS.findIndex((item) => item.stationId === station.stationId);
    return (stationIndex + 1) * 100 + slotNumber;
}

export function buildSlots(station: Station): Slot[] {
    return buildPresets(station).map((preset, index) => {
        const shape = PRESET[preset];
        const slotNumber = index + 1;
        const seq = seqOf(station, slotNumber);

        // 관리자가 방금 바꾼 슬롯이면 그 결과로 덮어씁니다. 목업 전용이라 새로고침하면 사라집니다.
        return applyOverride({
            // 신원은 UUID 입니다. 'SL-03-01' 은 화면에서 formatSlotLabel 로 만드는 라벨입니다.
            slotId: mockUuid(MOCK_NS.slot, seq),
            stationId: station.stationId,
            slotNumber,
            occupancyStatus: shape.occupancyStatus,
            serviceStatus: shape.serviceStatus,
            itemCondition: shape.itemCondition,
            lockStatus: shape.lockStatus,
            activeRentalId: shape.rented ? mockUuid(MOCK_NS.rental, seq) : null,
            inspection: shape.inspection
                ? {
                      inspectionId: mockUuid(MOCK_NS.inspection, seq),
                      reviewStatus: shape.inspection,
                  }
                : null,
            // 서버 계약과 같은 DATETIME(6) 형태로 둡니다. 표시할 때만 잘라 씁니다.
            updatedAt: `${UPDATED_DATE}T${shape.time}:00.000000+09:00`,
        });
    });
}

/** 상세 화면 상단에 표시하는 최근 통신 시각 */
export const STATION_SYNCED_AT = '2026-07-24 09:19';

/** 슬롯 목록 페이지당 행 수 */
export const SLOT_PAGE_SIZE = 8;
