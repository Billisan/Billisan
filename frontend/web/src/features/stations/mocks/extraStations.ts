import { MOCK_NS, mockSeq, mockUuid } from '@/features/stations/mocks/ids';
import type {
    LockStatus,
    SlotItemCondition,
    SlotOccupancyStatus,
    SlotServiceStatus,
    SlotSummary,
    Station,
} from '@/features/stations/types';

/**
 * **화면을 채우기 위한 가상 대여소 8곳.** 목업 모드에서만 존재합니다.
 *
 * 실서버에는 대여소가 「정문 대여소」 하나뿐이고, 그 한 곳은 `ec2Seed.ts` 가 실제 값
 * 그대로 갖고 있습니다. 여기 여덟 곳은 **서버에 없습니다** — 목록·지도·대시보드 집계가
 * 한 줄짜리로 남지 않게 두는 개발용 데이터입니다.
 *
 * ⚠️ **실 API 모드에는 절대 새지 않습니다.** 이 파일을 읽는 곳은 `mocks/` 안뿐이고,
 * `stationsApi` 는 `env.useMockData` 가 true 일 때만 그쪽으로 갑니다. 배포 빌드는
 * 그 분기가 컴파일 상수 false 라 번들에서 통째로 사라집니다(`npm run build` 로 확인).
 *
 * 좌표(`position`)는 분포도용 0~100 값입니다. ERD 에 좌표 컬럼이 없어 화면 배치값을
 * 여기서 정합니다.
 */

interface ExtraStationSeed {
    name: string;
    /** 이 대여소에 설치된 SLOT 행 수. 상위 기획 §4.1 「대여소당 3~5 SLOT」 범위입니다. */
    slotCount: number;
    deviceStatus: Station['deviceStatus'];
    serviceStatus: Station['serviceStatus'];
    position: { x: number; y: number };
}

const SEEDS: ExtraStationSeed[] = [
    {
        name: '정문 광장',
        slotCount: 5,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 20.1, y: 86.0 },
    },
    {
        name: '중앙도서관',
        slotCount: 5,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 46.8, y: 30.2 },
    },
    {
        name: '제1공학관',
        slotCount: 5,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 79.9, y: 38.6 },
    },
    {
        name: '경영관',
        slotCount: 4,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 28.2, y: 51.6 },
    },
    {
        name: '자연과학관',
        slotCount: 4,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 63.4, y: 66.1 },
    },
    {
        name: '생활관 A',
        slotCount: 5,
        /** 장치가 끊긴 대여소도 한 곳 둡니다 — 회색 배지가 실제로 그려지는지 보려고요. */
        deviceStatus: 'OFFLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 12.6, y: 44.3 },
    },
    {
        name: '빌리대역 출구',
        slotCount: 3,
        deviceStatus: 'ONLINE',
        /*
         * 대여소 단위 점검도 한 곳 둡니다.
         *
         * **슬롯의 `OUT_OF_SERVICE` 와 다른 값 집합입니다.** 대여소는
         * `AVAILABLE | MAINTENANCE | OFFLINE`(`StationServiceStatus`) 셋뿐입니다.
         * 두 축을 같은 이름으로 착각하기 쉬운 자리라 적어 둡니다.
         */
        serviceStatus: 'MAINTENANCE',
        position: { x: 88.1, y: 74.8 },
    },
    {
        name: '대운동장',
        slotCount: 4,
        deviceStatus: 'ONLINE',
        serviceStatus: 'AVAILABLE',
        position: { x: 55.0, y: 12.4 },
    },
];

/** 시안이 보여 주는 상태 조합 묶음. 실제 저장 값은 아래 PRESET 의 4축입니다. */
type SlotPreset =
    | 'AVAILABLE'
    /** AI 는 파손을 의심했지만 관리자가 이상 없음으로 뒤집은 슬롯. 표시는 AVAILABLE 과 같습니다. */
    | 'REVIEWED_NORMAL'
    /** 우산이 나가 있는 슬롯. 관리자 API 로는 '대여 중'을 알 수 없어 빈 슬롯으로 보입니다. */
    | 'LENT_OUT'
    | 'EMPTY'
    | 'DAMAGED'
    | 'ADMIN_REVIEW'
    /** 물리 반납은 끝났는데 서버 반영이 깨져 격리된 슬롯. */
    | 'RECOVERY';

interface PresetShape {
    occupancyStatus: SlotOccupancyStatus;
    serviceStatus: SlotServiceStatus;
    /** 점유가 EMPTY 면 null 입니다 (12-R B-4) */
    itemCondition: SlotItemCondition | null;
    lockStatus: LockStatus;
    inspection: 'PENDING' | 'DECIDED' | null;
    /** 'HH:mm' */
    time: string;
}

/**
 * 4축 조합은 `ADMIN-SLOT-STATUS-001` 허용 조합과 `ADMIN-INSPECTION-003` 판정 결과를 따릅니다.
 * - DAMAGED 판정        → OUT_OF_SERVICE + DAMAGED
 * - KEEP_ADMIN_REVIEW  → 검수 PENDING + ADMIN_REVIEW
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
    /**
     * 복구 필요.
     *
     * 우산은 안에 들어가 잠겨 있는데 DB 가 그걸 확정하지 못한 상태입니다. 점유·잠금을
     * `UNKNOWN` 으로 두는 건 "확정할 수 없다"를 그대로 담는 것입니다 — 복구 규칙이
     * "마지막 센서 저장값이나 마지막 잠금 명령을 현재 실물 상태로 간주하지 않는다"고
     * 못 박았습니다. 그래서 `itemCondition` 도 `UNKNOWN` 입니다.
     */
    RECOVERY: {
        occupancyStatus: 'UNKNOWN',
        serviceStatus: 'OUT_OF_SERVICE',
        itemCondition: 'UNKNOWN',
        lockStatus: 'UNKNOWN',
        inspection: null,
        time: '09:05',
    },
};

/**
 * 상태를 돌려 가며 배치하는 순환 패턴.
 *
 * 대여소마다 시작 위치가 달라서 같은 구성이 반복되지 않습니다. 슬롯이 3개든 5개든
 * 이 패턴으로 채워지므로 개수를 바꿔도 코드를 손댈 필요가 없습니다.
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

/**
 * 화면이 쓰는 대여소 모양. 집계는 `stations.ts` 가 슬롯을 세어 채웁니다.
 *
 * 🔒 **`import.meta.env.DEV` 로 잠급니다 — `npm run dev`(5173) 에서만 값이 있습니다.**
 *
 * `VITE_USE_MOCK_DATA` 만으로는 부족합니다. 그건 사람이 켜고 끄는 스위치라, 누가 실수로
 * 켠 채 배포하면 관리자 화면에 **있지도 않은 대여소 8곳**이 뜹니다. 관리자가 그걸 보고
 * 현장에 가거나, 재고가 40개라고 보고하게 됩니다.
 *
 * `DEV` 는 스위치가 아니라 빌드 종류입니다. `vite build` 에서는 컴파일 상수 `false` 라
 * 아래 삼항이 `[]` 로 접히고, `SEEDS`·`PRESET`·`PATTERN` 이 전부 참조를 잃어 번들에서
 * 사라집니다. 배포본에는 이름 한 글자도 남지 않습니다 (빌드 산출물로 확인).
 */
export const EXTRA_STATIONS: Station[] = import.meta.env.DEV
    ? SEEDS.map((seed, index) => ({
          stationId: mockUuid(MOCK_NS.station, index + 1),
          name: seed.name,
          serviceStatus: seed.serviceStatus,
          deviceStatus: seed.deviceStatus,
          slotCount: seed.slotCount,
          position: seed.position,
          // 아래는 buildSlots 결과로 다시 셉니다. 여기 값은 쓰이지 않습니다.
          available: 0,
          capacity: seed.slotCount,
          damaged: 0,
          adminReview: 0,
          unknownOccupancy: 0,
      }))
    : [];

const EXTRA_IDS = new Set(EXTRA_STATIONS.map((station) => station.stationId));

/** 이 대여소가 가상 대여소인지. 시드 대여소와 갈라 처리하려고 씁니다. */
export function isExtraStation(stationId: string): boolean {
    return EXTRA_IDS.has(stationId);
}

/** 대여소별 목업 시드. 슬롯 구성을 대여소마다 다르게 만들 뿐 업무 의미는 없습니다. */
function stationSeq(stationId: string): number {
    return mockSeq(stationId);
}

function presetNameOf(stationId: string, slotNumber: number): SlotPreset {
    return PATTERN[(stationSeq(stationId) + slotNumber - 1) % PATTERN.length];
}

/** 슬롯 번호 → 전역 목업 순번. 슬롯 ID 가 대여소끼리 겹치지 않게 자리를 가릅니다. */
function slotSeq(stationId: string, slotNumber: number): number {
    return stationSeq(stationId) * 100 + slotNumber;
}

/**
 * 이 슬롯에 걸린 검수 상태.
 *
 * **`buildSlots` 뿐 아니라 검수 상태를 묻는 쪽도 같은 패턴을 거쳐야 합니다.** 예전에는
 * 검수 상태만 따로 계산해서, 슬롯 모양과 검수 유무가 어긋난 적이 있습니다.
 */
export function extraInspectionStateOf(
    stationId: string,
    slotNumber: number,
): 'PENDING' | 'DECIDED' | null {
    return PRESET[presetNameOf(stationId, slotNumber)].inspection;
}

/** 가상 대여소의 슬롯 목록 — `ADMIN-SLOT-001` 의 `items[]` 모양. */
export function buildExtraSlots(station: Station): SlotSummary[] {
    return Array.from({ length: station.slotCount }, (_, index) => {
        const slotNumber = index + 1;
        const shape = PRESET[presetNameOf(station.stationId, slotNumber)];

        return {
            slotId: mockUuid(MOCK_NS.slot, slotSeq(station.stationId, slotNumber)),
            slotNumber,
            occupancyStatus: shape.occupancyStatus,
            serviceStatus: shape.serviceStatus,
            itemCondition: shape.itemCondition,
            lockStatus: shape.lockStatus,
            // 서버 계약과 같은 DATETIME(6) 형태로 둡니다. 표시할 때만 잘라 씁니다.
            updatedAt: `${UPDATED_DATE}T${shape.time}:00.000000+09:00`,
        };
    });
}
