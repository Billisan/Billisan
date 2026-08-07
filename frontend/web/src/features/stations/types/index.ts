import type { ReturnAttemptStatus } from '@/shared/constants/returnStatus';
import type { BadgeTone } from '@/shared/components/Badge';
import {
    AI_RESULT_LABEL,
    DECISION_LABEL,
    SLOT_DISPLAY_LABEL,
    codeHint,
} from '@/shared/constants/statusLabels';
import { formatDayTime } from '@/shared/lib/datetime';

/* ------------------------------------------------------------------ 대여소 */

/**
 * ERD v3.0 `STATION`.
 *
 * **신원은 `stationId`(UUID) 하나입니다.** ERD 가 "`station_id` 가 MQTT Topic·장치 설정·
 * 인터페이스 상관의 권위 식별자" 라고 못 박았습니다.
 *
 * **`stationCode`·`locationText` 는 쓰지 않습니다.** 같은 핵심 제약이 "`name` 은 표시용이며
 * `station_code`·`location_text` 를 **P0 필수 컬럼으로 두지 않는다**" 라고 정했습니다
 * (변경 이력 `DEC-047`). 필수가 아닌 값에 화면을 걸면 서버가 안 줘도 계약 위반이 아니라서
 * 그대로 무너집니다. 표시는 `name`(NOT NULL)으로만 합니다.
 *
 * ERD v3.0 컬럼: `station_id CHAR(36) PK` · `name` · `service_status` · `device_status` ·
 *                `current_boot_id` · `boot_synced_at` · `last_seen_at` · `created_at` ·
 *                `updated_at`  — 위도·경도도 없습니다(지도 화면 보류 근거).
 */
export type StationServiceStatus = 'AVAILABLE' | 'MAINTENANCE' | 'OFFLINE';
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'ERROR';

export interface Station {
    /** ERD PK. 라우트·API·표시 모두 이 값이 신원입니다. */
    stationId: string;
    /** `name` — '제1공학관'. NOT NULL 이라 표시는 항상 이걸로 합니다. */
    name: string;
    serviceStatus: StationServiceStatus;
    /**
     * `device_status`. 값이 셋이라 boolean 으로 접지 않습니다 —
     * `ERROR` 를 `OFFLINE` 과 같이 취급하면 장치 오류가 화면에서 사라집니다.
     *
     * **`null` 은 「알 수 없음」입니다.** DB(`STATION.device_status`)에는 있는 값인데
     * 이걸 내려 주는 관리자 API 가 없습니다(스웨거 9개 경로 전수 확인). 예전에는 실 모드에서
     * `'ONLINE'` 을 박아 넣었는데, 재고 API 가 응답한 건 **서버가 살아 있다**는 뜻이지
     * **현장의 함이 살아 있다**는 뜻이 아닙니다. 함이 꺼져 있어도 DB 행은 그대로라
     * 서버는 200 을 돌려주고, 화면만 「연결됨」이라고 거짓말하게 됩니다.
     * TODO: 대여소 조회 API 가 `device_status`·`last_seen_at` 을 주면 그 값으로 바꾸세요.
     */
    deviceStatus: DeviceStatus | null;

    /**
     * 이 대여소에 설치된 SLOT 행 수.
     *
     * ERD: "SLOT 행 수와 Station 설정으로 수량을 결정하고 애플리케이션·DDL에 1 또는 3~5를
     * 상수로 고정하지 않는다." 그래서 개수를 코드에 박지 않고 대여소마다 들고 있습니다.
     */
    slotCount: number;

    /*
     * 아래 집계는 STATION 컬럼이 아니라 `ADMIN-INVENTORY-001` 이 SLOT 행을 세어 주는 값입니다
     * (ERD §6.1: "재고 수량은 별도 저장하지 않고 대여 가능한 슬롯 수를 조회 시 계산한다").
     */
    available: number;
    capacity: number;
    damaged: number;
    adminReview: number;
    /**
     * 점유 센서를 못 읽은 슬롯 수 (`unknownOccupancySlotCount`).
     *
     * 대여소 단위 「온라인」과 다릅니다 — 그건 함 전체가 서버와 통신되느냐이고, 이건
     * **함은 멀쩡한데 그 칸 센서만 우산 유무를 못 읽는** 상태입니다. 조치도 갈립니다
     * (통신 복구 vs 슬롯 점검). 평소엔 0 이고, 0 이 아닌 순간이 곧 나가 봐야 한다는 신호입니다.
     */
    unknownOccupancy: number;

    /**
     * 분포도 좌표 (0~100 백분율).
     *
     * **ERD 에 좌표 컬럼이 없습니다.** `location_text VARCHAR(255)` 자유 텍스트만 있어서
     * 지도·분포도 화면의 데이터 출처가 없습니다. 지금은 목업 전용 값입니다.
     * TODO: 백엔드에 좌표 컬럼 추가를 요청하거나 지도 화면을 접어야 합니다.
     */
    position: { x: number; y: number };
}

/** 장치가 붙어 있는지. `ERROR` 는 연결로 치지 않고, `null`(정보 없음)도 확신할 수 없습니다. */
export function isDeviceOnline(station: Station): boolean {
    return station.deviceStatus === 'ONLINE';
}

/**
 * 장치가 **끊겼다고 말할 수 있는지.** `isDeviceOnline` 의 반대가 아닙니다.
 *
 * `null` 은 「알 수 없음」이라 어느 쪽으로도 단정하면 안 됩니다. `!isDeviceOnline()` 으로
 * 판단하면 정보가 없는 대여소를 전부 **오프라인으로 몰아** 재고가 멀쩡한 곳까지
 * 「연결 끊김」으로 그리게 됩니다.
 */
export function isDeviceOffline(station: Station): boolean {
    return station.deviceStatus === 'OFFLINE' || station.deviceStatus === 'ERROR';
}

/** 대여소 재고 상태 */
export type StationStatus = 'SHORTAGE' | 'NORMAL' | 'SURPLUS' | 'OFFLINE';

/**
 * 재고 상태 임계값 — **개수가 아니라 채움 비율입니다.**
 *
 * 화면흐름 §13: "부족·정상·과잉은 영속 Enum이 아니라 **재고 비율**·수요 예측에서
 * 파생되는 UI 상태다."
 *
 * 예전에는 대여 가능 **개수**로 갈랐습니다(4개 이상 과잉, 2개 이상 적정). 대여소마다
 * 슬롯이 3~5개로 다른데 같은 잣대를 대니 작은 대여소가 계속 손해를 봤습니다.
 * 슬롯 3개짜리가 **꽉 차 있어도**(3/3, 100%) 「적정」으로 나왔고, 그래서 재배치
 * 후보에서 빠졌습니다. 반대로 슬롯 5개에 4개 남은 곳(80%)은 과잉으로 잡혔습니다.
 *
 * 비율로 바꾸면 규모와 무관하게 같은 뜻이 됩니다. 슬롯이 5개인 대여소에서는 예전 기준과
 * 결과가 같습니다(0~1 부족 · 2~3 적정 · 4~5 과잉) — 바뀌는 건 3·4개짜리뿐입니다.
 *
 * TODO: §13 이 말하는 '수요 예측'은 아직 계약이 없습니다. 지금은 비율만 씁니다.
 */
export const STOCK_RATIO_THRESHOLD = {
    /** 이 비율 이상이면 과잉 */
    surplus: 2 / 3,
    /** 이 비율 이상이면 적정, 미만이면 부족 */
    normal: 1 / 3,
} as const;

/**
 * 채움 비율. 슬롯이 0개면 0 입니다.
 *
 * `capacity` 는 `ADMIN-INVENTORY-001` 의 `totalSlotCount` 입니다. 0 으로 나누면 `NaN` 이
 * 되고 `NaN` 은 어떤 비교에도 false 라 조용히 「부족」으로 떨어집니다. 슬롯이 없는
 * 대여소에 빌려줄 우산도 없으니 결론은 같지만, 우연에 기대지 않고 명시합니다.
 */
export function stockRatio(station: Station): number {
    return station.capacity > 0 ? station.available / station.capacity : 0;
}

export function getStationStatus(station: Station): StationStatus {
    /*
     * 장치가 끊긴 대여소는 재고를 믿을 수 없습니다. 비율보다 먼저 봅니다.
     * **`!isDeviceOnline()` 이 아니라 `isDeviceOffline()` 입니다** — 장치 상태를 모르는
     * (`null`) 대여소까지 오프라인으로 몰면 실 API 모드에서 전 대여소가 「연결 끊김」이 됩니다.
     */
    if (isDeviceOffline(station)) return 'OFFLINE';

    const ratio = stockRatio(station);
    if (ratio >= STOCK_RATIO_THRESHOLD.surplus) return 'SURPLUS';
    if (ratio >= STOCK_RATIO_THRESHOLD.normal) return 'NORMAL';
    return 'SHORTAGE';
}

/** 상태별 라벨 + Tailwind 클래스 (문자열 리터럴이어야 JIT 가 클래스를 뽑아냅니다) */
export const STATION_STATUS_META: Record<
    StationStatus,
    { label: string; bg: string; text: string }
> = {
    SHORTAGE: { label: '부족', bg: 'bg-status-shortage', text: 'text-status-shortage' },
    NORMAL: { label: '적정', bg: 'bg-status-normal', text: 'text-status-normal' },
    SURPLUS: { label: '과잉', bg: 'bg-status-surplus', text: 'text-status-surplus' },
    OFFLINE: {
        label: '오프라인',
        bg: 'bg-status-offline',
        text: 'text-status-offline-text',
    },
};

/** 지도 범례에 노출할 상태 (오프라인은 범례에서 제외) */
export const LEGEND_STATUSES: StationStatus[] = ['SHORTAGE', 'NORMAL', 'SURPLUS'];

/**
 * 재고 순위 정렬: 잔량 많은 순으로, **끊긴 것이 확인된** 대여소만 맨 뒤로.
 *
 * 장치 상태를 모르는(`null`) 대여소는 뒤로 밀지 않습니다 — 모른다는 이유로 순위를
 * 떨어뜨리면 실제로는 재고가 제일 많은 곳이 맨 아래에 깔립니다.
 */
export function sortByStock(stations: Station[]): Station[] {
    return [...stations].sort((a, b) => {
        const aOff = isDeviceOffline(a);
        const bOff = isDeviceOffline(b);
        if (aOff !== bOff) return aOff ? 1 : -1;
        return b.available - a.available;
    });
}

/* -------------------------------------------------------------------- 슬롯 */

/**
 * 슬롯 상태는 4축입니다 (화면흐름 §17 / API명세 §3.1).
 * 단일 상태 하나로 저장하거나 전송하지 않습니다 (GAP-WEB-015).
 */
export type SlotServiceStatus = 'AVAILABLE' | 'ADMIN_REVIEW' | 'OUT_OF_SERVICE';
export type SlotOccupancyStatus = 'EMPTY' | 'OCCUPIED' | 'UNKNOWN';
export type LockStatus = 'LOCKED' | 'UNLOCKED' | 'UNKNOWN' | 'ERROR';

/**
 * 슬롯의 품질 상태.
 *
 * ⚠️ **`EMPTY` 와 `null` 이 둘 다 옵니다. 둘 다 「빈 슬롯」입니다.**
 *
 * 12-R B-4 는 "빈 슬롯은 `null`" 이라고 했고 우리는 그 말만 믿고 `EMPTY` 를 타입에서
 * 뺐습니다. 그런데 백엔드 구현은 다릅니다 — 응답 DTO 가 변환 없이 컬럼을 그대로
 * 내보내고(`getItemCondition() == null ? null : ....name()`), 시연 시드 SQL 은 빈 슬롯에
 * **문자열 `'EMPTY'`** 를 넣습니다(`30-rental-return-preconditions.sql`).
 *
 * 그러면 `"EMPTY"` 가 응답에 실려 오는데 타입에 없으니 `ITEM_CONDITION_TONE['EMPTY']`
 * 가 `undefined` 가 되어 **배지가 색 없이** 그려집니다. 목업에서는 절대 안 나타나고
 * 실 API 에서만 드러나는 종류입니다.
 *
 * 그래서 **둘 다 받습니다.** 어느 쪽이 오든 화면은 같게 그립니다.
 * TODO: 백엔드가 `null` 로 통일하면 `EMPTY` 를 빼세요 — 그전까지는 남겨 둡니다.
 */
export type SlotItemCondition = 'EMPTY' | 'NORMAL' | 'DAMAGED' | 'REPAIRABLE' | 'UNKNOWN';

/**
 * `ADMIN-SLOT-STATUS-001` 요청의 `targetItemCondition`.
 *
 * 응답 타입과 값 집합이 같아졌지만 **별칭을 남깁니다** — 요청과 응답은 서로 다른 계약이라
 * 한쪽이 바뀌어도 다른 쪽이 따라가면 안 됩니다.
 */
export type SlotTargetItemCondition = SlotItemCondition;

/**
 * `ADMIN-SLOT-001` 의 `items[]` 한 줄. **응답에 있는 필드가 전부입니다.**
 *
 * 활성 대여도, 검수 요약도 이 응답에 없습니다. 그래서 목록에서는 '대여 중'·'검수 대기'를
 * 표시할 수 없고, 그 정보는 `ADMIN-SLOT-DETAIL-001` 에만 있습니다.
 *
 * 슬롯에도 코드 컬럼이 없습니다. 표기는 `slotNumber`(NOT NULL)로만 만듭니다 —
 * 예전에는 `stationCode` 뒤 두 자리를 붙여 'SL-03-01' 을 만들었는데, 그 컬럼이 P0 필수가
 * 아니라 서버가 안 주면 라벨부터 무너집니다.
 */
export interface SlotSummary {
    /** UUID. 라우트·API 에 쓰는 신원입니다. */
    slotId: string;
    /** 대여소 안에서의 표시 번호 */
    slotNumber: number;
    occupancyStatus: SlotOccupancyStatus;
    /** 점유가 `EMPTY` 면 `null` */
    itemCondition: SlotItemCondition | null;
    serviceStatus: SlotServiceStatus;
    lockStatus: LockStatus;
    /**
     * 서버 updatedAt 원문이자 CAS 기준. `DATETIME(6)` 마이크로초라서 Date 로 파싱했다가
     * 다시 만들면 자릿수가 잘려 CAS 가 항상 409 가 됩니다. 문자열 그대로 보관하세요.
     */
    updatedAt: string;
}

/** `ADMIN-SLOT-DETAIL-001` 의 `latestReturnAttempt` */
export interface SlotReturnAttemptRef {
    returnAttemptId: string;
    rentalId: string;
    /**
     * 반납 시도 진행 단계. 값 집합은 이력 화면과 같은 것이라 타입을 함께 씁니다 —
     * 백엔드 `ReturnAttempt.Status` 도 같은 다섯 개입니다.
     * 라벨·톤은 `RETURN_STATUS_LABEL`·`RETURN_STATUS_TONE`(ERD 「반납 상태도 보조 표시 기준」).
     */
    status: ReturnAttemptStatus;
}

/** `ADMIN-SLOT-DETAIL-001` 의 `latestInspection` */
export interface SlotInspectionRef {
    inspectionId: string;
    /** 추론이 아직 안 끝났으면 null (백엔드 실측 — FAILED 와 다른 상태입니다) */
    aiResult: AiInspectionResult | null;
    /** 추론 실패 시 null */
    aiScore: number | null;
    modelVersion: string;
    processedAt: string;
    reviewStatus: 'PENDING' | 'DECIDED';
    /** 미확정이면 null */
    decision: InspectionDecision | null;
}

/** `ADMIN-SLOT-DETAIL-001` 응답 `data` */
export interface SlotDetail extends SlotSummary {
    stationId: string;
    /** 최근 연결 반납 시도. 없으면 null */
    latestReturnAttempt: SlotReturnAttemptRef | null;
    /** 최근 연결 검수 메타데이터. 없으면 null */
    latestInspection: SlotInspectionRef | null;
    /** 최근 관리자 변경자. 시스템 변경이면 null */
    updatedBy: string | null;
}

/**
 * 표시용 슬롯 표기. `1` → `'1번 슬롯'`.
 *
 * `slot_number` 는 `UNIQUE(station_id, slot_number)` 라 **대여소 안에서만** 유일합니다.
 * 그래서 어느 대여소인지 함께 보여야 하는 자리에서는 대여소 `name` 을 옆에 붙이세요.
 *
 * 예전 `'SL-03-01'` 은 `stationCode` 뒤 두 자리에 의존했는데, ERD v3.0 이 그 컬럼을
 * P0 필수에서 뺐습니다. 검수 상세는 원래부터 `ADMIN-INSPECTION-002` 의 `slotNumber` 로
 * `'1번 슬롯'` 을 쓰고 있었어서, 이제 앱 전체 표기가 하나로 맞습니다.
 *
 * DB 에 이런 문자열 컬럼은 없습니다. 화면에서만 쓰고 검색·라우팅에는 쓰지 마세요.
 */
export function formatSlotLabel(slotNumber: number): string {
    return `${slotNumber}번 슬롯`;
}

/** 표에 한 칸으로 보여줄 파생 상태. 저장되는 값이 아닙니다. */
export type SlotDisplayStatus =
    'AVAILABLE' | 'EMPTY' | 'DAMAGED' | 'ADMIN_REVIEW' | 'OUT_OF_SERVICE' | 'UNKNOWN';

/**
 * 4축 → 표시용 상태 하나.
 *
 * **'대여 중'은 없습니다.** 관리자 API 어디에도 활성 대여 연결이 없습니다 —
 * 슬롯 목록에도, 슬롯 상세에도 (상세의 `latestReturnAttempt` 는 '최근 반납 시도'이지
 * '지금 나가 있는 대여'가 아닙니다). 우산이 대여 중인 슬롯은 서버 기준으로도
 * `EMPTY + AVAILABLE` 이며, 화면도 그대로 '빈 슬롯'으로 보여줍니다.
 *
 * 대여 가능 조건은 `AVAILABLE + OCCUPIED + NORMAL + LOCKED` 입니다 (ERD SLOT 불변조건).
 */
/**
 * 4축만 있으면 판정할 수 있습니다.
 *
 * `SlotSummary` 전체를 요구하면 검수 상세(`ADMIN-INSPECTION-002`)가 못 씁니다 — 거기서는
 * 같은 4축이 `slotOccupancyStatus` 처럼 평면 필드로 오고 `slotId`·`updatedAt` 이 슬롯의
 * 것이 아닙니다. 좁혀 두면 두 화면이 **같은 함수로 같은 배지**를 그립니다.
 */
export type SlotStateAxes = Pick<
    SlotSummary,
    'occupancyStatus' | 'itemCondition' | 'serviceStatus' | 'lockStatus'
>;

export function deriveSlotDisplayStatus(slot: SlotStateAxes): SlotDisplayStatus {
    if (slot.serviceStatus === 'ADMIN_REVIEW') return 'ADMIN_REVIEW';
    if (slot.itemCondition === 'DAMAGED' || slot.itemCondition === 'REPAIRABLE') return 'DAMAGED';
    if (slot.serviceStatus === 'OUT_OF_SERVICE') return 'OUT_OF_SERVICE';
    if (slot.occupancyStatus === 'EMPTY') return 'EMPTY';
    if (
        slot.occupancyStatus === 'OCCUPIED' &&
        slot.itemCondition === 'NORMAL' &&
        slot.serviceStatus === 'AVAILABLE' &&
        slot.lockStatus === 'LOCKED'
    ) {
        return 'AVAILABLE';
    }
    return 'UNKNOWN';
}

/**
 * 화면에 적을 우산 상태. **우산이 없으면 `null`** 입니다.
 *
 * 서버는 대여가 나갈 때 점유·잠금 두 축만 갱신하고 `itemCondition` 은 그대로 둡니다
 * (`Slot.applyObservedPhysicalState` — 물리 센서 관측값이라 관리자 판단 축은 건드리지
 * 않는다). 그래서 **우산이 빠져나간 슬롯에 `NORMAL` 이 남습니다.** 실서버에서 실제로
 * 그 상태를 확인했습니다(점유 `EMPTY` + 품질 `NORMAL`).
 *
 * 그대로 그리면 같은 화면이 서로 다른 말을 합니다 — 요약 배지는 「빈 슬롯」인데
 * 상세 줄은 「정상」. 없는 우산을 정상이라고 단정하는 셈입니다.
 *
 * `itemCondition` 자체가 `null` 로 오는 경우와 결과를 같게 둡니다. 화면은 둘을 구분할
 * 이유가 없고, 구분하면 관리자가 익힐 규칙만 하나 늘어납니다.
 *
 * **원값이 필요한 자리는 이 함수를 쓰지 마세요.** 검수 상세는 「우산 유무」와 「우산
 * 상태」를 나란히 놓아 어긋남 자체를 보여 주는 화면이라 원값이 맞습니다.
 */
export function displayItemCondition(
    slot: Pick<SlotStateAxes, 'occupancyStatus' | 'itemCondition'>,
): SlotItemCondition | null {
    if (slot.occupancyStatus === 'EMPTY') return null;
    return slot.itemCondition;
}

/** 파생 상태 → 배지에 찍을 한글 (ERD §2.4.1 "관리자 웹의 배지·표는 한글 명칭 우선") */
export function slotStatusText(status: SlotDisplayStatus): string {
    return SLOT_DISPLAY_LABEL[status];
}

/** 같은 상태의 마우스오버용 `한글 · CODE`. 로그·백엔드와 대조할 때 씁니다. */
export function slotStatusHint(status: SlotDisplayStatus): string {
    /*
     * `UNKNOWN` 은 배지 글자가 이미 코드입니다(의도한 예외, `SLOT_DISPLAY_LABEL` 주석 참고).
     * 그대로 `codeHint` 를 태우면 'UNKNOWN · UNKNOWN' 이 나와서 마우스오버가 아무것도
     * 보태지 않습니다. 이 값만 **한글 뜻을 마우스오버로 돌립니다** — 배지는 눈에 걸리게,
     * 뜻은 필요할 때. 다른 배지의 `한글 · CODE` 모양은 그대로 지킵니다.
     */
    if (status === 'UNKNOWN') return `상태 불명 · ${status}`;
    return codeHint(SLOT_DISPLAY_LABEL, status);
}

/**
 * AI 보조 판정 결과.
 *
 * 슬롯 상태와 **다른 값 집합**입니다 (화면흐름 §17: "AI `NORMAL|DAMAGED|UNCERTAIN|FAILED`는 보조 결과").
 * AI 가 DAMAGED 를 내도 파손이 확정되지 않습니다. 슬롯은 `ADMIN_REVIEW` 로 격리되고
 * 관리자가 판정해야 확정됩니다 (API명세 §3.1: "자동 파손 확정·자동 과금을 의미하지 않는다").
 */
export type AiInspectionResult = 'NORMAL' | 'DAMAGED' | 'UNCERTAIN' | 'FAILED';

export const AI_RESULT_TONE: Record<AiInspectionResult, BadgeTone> = {
    NORMAL: 'green',
    DAMAGED: 'red',
    UNCERTAIN: 'amber',
    FAILED: 'slate',
};

/*
 * 아래 셋이 null 을 받는 이유: 추론이 아직 안 끝난 검수는 `aiResult` 가 null 로 옵니다
 * (백엔드 실측). FAILED(추론이 죽음)와는 다른 상태라 「검수 실패」로 뭉개지 않고
 * 「분석 전」으로 따로 말합니다.
 */

/** AI 결과 → 배지 톤 */
export function aiResultTone(result: AiInspectionResult | null): BadgeTone {
    return result ? AI_RESULT_TONE[result] : 'slate';
}

/** AI 결과 → 한글 */
export function aiResultText(result: AiInspectionResult | null): string {
    return result ? AI_RESULT_LABEL[result] : '분석 전';
}

/** AI 결과 마우스오버용 `한글 · CODE` */
export function aiResultHint(result: AiInspectionResult | null): string {
    return result ? codeHint(AI_RESULT_LABEL, result) : '분석 전 · 추론이 아직 끝나지 않았습니다';
}

/**
 * 관리자 최종 판정. ADMIN-INSPECTION-003 이 받는 값입니다.
 *
 * AI 결과와도, 슬롯 상태와도 **다른 집합**입니다.
 * 화면흐름 §17: "inspection decision 과 slot item/service Enum을 별도 control로 매핑한다.
 * `DAMAGED` decision과 item state를 혼동하지 않는다."
 *
 * 판정이 만드는 슬롯 상태는 화면흐름 §10.2 에 정해져 있습니다.
 *   NORMAL            → AVAILABLE + NORMAL (정산 없음)
 *   DAMAGED           → OUT_OF_SERVICE + DAMAGED (파손 정산 멱등 생성)
 *   KEEP_ADMIN_REVIEW → 검수 PENDING + ADMIN_REVIEW (정산 없음)
 */
export type InspectionDecision = 'NORMAL' | 'DAMAGED' | 'KEEP_ADMIN_REVIEW';

export const DECISION_TONE: Record<InspectionDecision, BadgeTone> = {
    NORMAL: 'green',
    DAMAGED: 'red',
    KEEP_ADMIN_REVIEW: 'amber',
};

/** 관리자 판정 → 한글 */
export function decisionText(decision: InspectionDecision): string {
    return DECISION_LABEL[decision];
}

/** 관리자 판정 마우스오버용 `한글 · CODE` */
export function decisionHint(decision: InspectionDecision): string {
    return codeHint(DECISION_LABEL, decision);
}

/**
 * 표시 상태 → 배지 색.
 *
 * **여섯 상태가 서로 다른 색을 갖습니다.** 예전에는 `빈 슬롯`·`이용 중지`·`확인 필요`
 * 셋이 모두 회색이라 표에서 구분되지 않았습니다. 셋의 성격은 전혀 다릅니다.
 *
 *   빈 슬롯     정상. 우산이 나가 있을 뿐이고 관리자가 할 일이 없습니다.
 *   이용 중지   운영에서 빠진 상태. 사람이 손대야 풀립니다.
 *   확인 필요   4축이 모순이라 무엇인지 확정할 수 없는 상태.
 *
 * ---
 *
 * **`이용 중지` 와 `빈 슬롯` 의 색을 맞바꿨습니다.**
 *
 * 보라는 뜻이 있어서 고른 색이 아니라 "빨강이 파손에 이미 쓰여서 밀려난" 자리였습니다.
 * 그래서 「이용 중지」 배지를 봐도 무슨 뜻인지 색이 거들지 못했습니다. 회색은 **꺼짐·
 * 비활성**으로 읽히고, 그게 「운영에서 뺌」과 그대로 맞습니다.
 *
 * 대신 `빈 슬롯` 이 보라로 갑니다. 원래 회색이던 이유는 "아무 일 없으니 눈에 안 띄어도
 * 된다" 였는데, 색이 여섯 개뿐이라 하나를 회색으로 쓰면 다른 하나는 남은 색을 받아야
 * 합니다. 둘 다 회색으로 두면 예전에 고쳤던 "구분 안 됨"이 그대로 돌아옵니다.
 *
 * TODO: 「빈 슬롯」이 보라라 조용한 상태치고 눈에 띈다면, 옅은 톤을 새로 추가해
 * 거기로 옮기세요 (지금은 `BadgeTone` 여섯 개가 전부라 자리가 없습니다).
 */
export const SLOT_DISPLAY_TONE: Record<SlotDisplayStatus, BadgeTone> = {
    /** 대여 가능 — 4축이 모두 맞은 상태 */
    AVAILABLE: 'green',
    /**
     * 우산이 나가 있음 — **회색입니다.**
     *
     * 한때 「이용 중지」에 회색을 넘기고 보라를 받았는데, 표에서 정상인 슬롯이 제일
     * 튀어 보였습니다. 빈 슬롯은 **손댈 게 없는 상태**입니다(누가 빌려 갔을 뿐).
     * 조치가 필요 없는 건 조용해야 훑을 때 걸리지 않습니다.
     */
    EMPTY: 'slate',
    /** 파손 확정 */
    DAMAGED: 'red',
    /** 관리자 미판정 */
    ADMIN_REVIEW: 'amber',
    /**
     * 운영 제외 — 회색을 「빈 슬롯」에 돌려주고 보라를 받았습니다.
     *
     * 「꺼짐=회색」이 자연스럽긴 하지만, 이 상태는 **관리자가 빼 둔 것**이라 복구할
     * 때까지 남아 있습니다. 회색으로 죽여 놓으면 표에서 잊힙니다.
     */
    OUT_OF_SERVICE: 'violet',
    /** 확정 불가. 파란색은 '진행 중'을 뜻해 오해가 없습니다. */
    UNKNOWN: 'blue',
};

/**
 * 서비스 상태 → 배지 톤. **파생 배지가 아니라 `service_status` 축 전용입니다.**
 *
 * 세 값이 `SLOT_DISPLAY_TONE` 의 같은 이름 항목과 색이 같습니다. 축은 다르지만 관리자가
 * 읽는 뜻은 같기 때문입니다 — 초록은 열려 있음, 주황은 사람 판단 대기, 보라는 운영에서
 * 뺌. 표에서 보던 색과 상세의 「서비스」 행 색이 어긋나면 같은 상태를 다른 것으로 읽습니다.
 *
 * `SLOT_DISPLAY_TONE` 을 그대로 쓰지 않고 따로 두는 이유는 **키 집합이 다르기** 때문입니다.
 * 파생 배지에는 `EMPTY`·`DAMAGED`·`UNKNOWN` 이 있는데 서비스 축에는 없습니다. 그쪽을
 * 재사용하면 서비스 축에 있을 수 없는 값도 타입상 허용돼, 잘못 넘겨도 컴파일러가 못 잡습니다.
 */
export const SLOT_SERVICE_TONE: Record<SlotServiceStatus, BadgeTone> = {
    AVAILABLE: SLOT_DISPLAY_TONE.AVAILABLE,
    ADMIN_REVIEW: SLOT_DISPLAY_TONE.ADMIN_REVIEW,
    /*
     * **손으로 적지 않고 위 표를 참조합니다.** 예전에는 `'slate'` 처럼 색을 그대로
     * 적어 뒀는데, `SLOT_DISPLAY_TONE` 에서 「이용 중지」를 보라로 바꿨을 때 이쪽이
     * 회색으로 남아 같은 슬롯이 목록에서는 보라, 검수 상세에서는 회색이 됐습니다.
     * 키 집합이 달라서 표는 따로 두되, 값은 한 곳만 보게 합니다.
     */
    OUT_OF_SERVICE: SLOT_DISPLAY_TONE.OUT_OF_SERVICE,
};

/**
 * 우산 품질 상태 → 배지 톤. **파생 배지가 아니라 `item_condition` 축 전용입니다.**
 *
 * 위 `SLOT_DISPLAY_TONE` 과 같은 색 규칙을 씁니다 — green 정상 · red 파손 확정 ·
 * amber 사람 판단 대기 · violet 관리자가 이미 묶어 둔 것 · slate 중립.
 *
 * `REPAIRABLE` 이 `DAMAGED`(빨강)와 갈라져야 하는 이유: **관리자가 할 일이 다릅니다.**
 * 파손은 판정이 끝나 정산까지 걸린 상태고, 수리 가능은 ERD 가 "관리자 품질 상태"라고
 * 부르는 값으로 고쳐서 되돌릴 수 있습니다. 둘 다 빨강이면 폐기할 우산과 고칠 우산이
 * 같아 보입니다. 「이용 중지」와 같은 보라를 쓰는 건 성격이 같아서입니다 —
 * 관리자가 의도적으로 빼 둔 상태.
 *
 * `UNKNOWN` 은 amber 입니다. ERD 의미가 "AI 불확실·오류·물리 불일치"라 아직 아무도
 * 판정하지 않은 자리이고, 그게 `ADMIN_REVIEW`(판정 대기)와 같은 결입니다.
 */
export const ITEM_CONDITION_TONE: Record<SlotItemCondition, BadgeTone> = {
    /**
     * 빈 슬롯 — 파생 배지의 `EMPTY` 와 **같은 회색**입니다.
     *
     * 서버가 `null` 대신 `"EMPTY"` 를 보낼 때 쓰입니다(시연 시드가 그렇습니다).
     * 색이 없으면 배지가 밋밋하게 그려져, 목록의 「빈 슬롯」과 상세의 「우산 상태」가
     * 같은 상태인데 달라 보입니다.
     */
    EMPTY: 'slate',
    NORMAL: 'green',
    DAMAGED: 'red',
    /*
     * **보라에서 파랑으로 바꿨습니다.** 파생 배지의 「이용 중지」도 보라라, 같은 화면에
     * 보라 배지 둘이 다른 뜻으로 뜰 수 있었습니다(시드 5번 슬롯이 그 경우 —
     * 목록은 「파손 우산」, 상세는 「수리 가능」).
     */
    REPAIRABLE: 'blue',
    UNKNOWN: 'amber',
};

/**
 * 검수 상세로 넘길 수 있는 슬롯인지.
 *
 * 검수 요약은 슬롯 **상세**에만 있습니다. 목록(`SlotSummary`)으로는 판단할 수 없습니다.
 */
export function pendingInspectionId(slot: SlotDetail): string | null {
    return slot.latestInspection?.reviewStatus === 'PENDING'
        ? slot.latestInspection.inspectionId
        : null;
}

/**
 * 서버 updatedAt(마이크로초 포함)을 표의 'MM-DD HH:mm' 로 자릅니다.
 *
 * 자르는 규칙은 이력 화면과 **한 곳**(`shared/lib/datetime`)에 둡니다 — 같은 형식을
 * 두 군데서 따로 자르다 한쪽만 고쳐지는 일이 실제로 있었습니다.
 */
export function formatUpdatedAt(updatedAt: string): string {
    return formatDayTime(updatedAt);
}
