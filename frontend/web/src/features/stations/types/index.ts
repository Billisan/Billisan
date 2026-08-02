import type { ReturnAttemptStatus } from '@/features/history/types';
import type { BadgeTone } from '@/shared/components/Badge';
import {
    AI_RESULT_LABEL,
    DECISION_LABEL,
    SLOT_DISPLAY_LABEL,
    codeHint,
} from '@/shared/constants/statusLabels';

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
     */
    deviceStatus: DeviceStatus;

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
     * 분포도 좌표 (0~100 백분율).
     *
     * **ERD 에 좌표 컬럼이 없습니다.** `location_text VARCHAR(255)` 자유 텍스트만 있어서
     * 지도·분포도 화면의 데이터 출처가 없습니다. 지금은 목업 전용 값입니다.
     * TODO: 백엔드에 좌표 컬럼 추가를 요청하거나 지도 화면을 접어야 합니다.
     */
    position: { x: number; y: number };
}

/** 장치가 붙어 있는지. `ERROR` 는 연결로 치지 않습니다. */
export function isDeviceOnline(station: Station): boolean {
    return station.deviceStatus === 'ONLINE';
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
    // 장치가 끊긴 대여소는 재고를 믿을 수 없습니다. 비율보다 먼저 봅니다.
    if (!isDeviceOnline(station)) return 'OFFLINE';

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

/** 재고 순위 정렬: 운영 중인 대여소를 잔량 많은 순으로, 오프라인은 맨 뒤로 */
export function sortByStock(stations: Station[]): Station[] {
    return [...stations].sort((a, b) => {
        const aOn = isDeviceOnline(a);
        const bOn = isDeviceOnline(b);
        if (aOn !== bOn) return aOn ? -1 : 1;
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
 * 응답의 품질 상태. **`EMPTY` 가 없습니다** — 빈 슬롯은 `null` 로 옵니다 (12-R B-4).
 * 예전에 "ERD 는 EMPTY, API 는 null" 로 열어 뒀던 충돌이 API 쪽으로 확정됐습니다.
 */
export type SlotItemCondition = 'NORMAL' | 'DAMAGED' | 'REPAIRABLE' | 'UNKNOWN';

/**
 * `ADMIN-SLOT-STATUS-001` 요청의 `targetItemCondition`.
 * 요청에는 `EMPTY` 가 **포함**됩니다. 응답 enum 과 달라서 타입을 나눠 둡니다.
 */
export type SlotTargetItemCondition = 'EMPTY' | SlotItemCondition;

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

/** 파생 상태 → 배지에 찍을 한글 (ERD §2.4.1 "관리자 웹의 배지·표는 한글 명칭 우선") */
export function slotStatusText(status: SlotDisplayStatus): string {
    return SLOT_DISPLAY_LABEL[status];
}

/** 같은 상태의 마우스오버용 `한글 · CODE`. 로그·백엔드와 대조할 때 씁니다. */
export function slotStatusHint(status: SlotDisplayStatus): string {
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
 * 그래서 아무 일 없는 `빈 슬롯` 만 회색으로 두고 나머지를 갈랐습니다.
 */
export const SLOT_DISPLAY_TONE: Record<SlotDisplayStatus, BadgeTone> = {
    /** 대여 가능 — 4축이 모두 맞은 상태 */
    AVAILABLE: 'green',
    /** 우산이 나가 있음. 정상이라 눈에 띌 이유가 없습니다. */
    EMPTY: 'slate',
    /** 파손 확정 */
    DAMAGED: 'red',
    /** 관리자 판정 대기 */
    ADMIN_REVIEW: 'amber',
    /** 운영 제외. 빨강은 파손이 쓰고 있어 보라로 갈랐습니다. */
    OUT_OF_SERVICE: 'violet',
    /** 확정 불가. 파란색은 '진행 중'을 뜻해 오해가 없습니다. */
    UNKNOWN: 'blue',
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
    NORMAL: 'green',
    DAMAGED: 'red',
    REPAIRABLE: 'violet',
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
 * Date 로 파싱하지 않고 문자열만 잘라서 원문을 보존합니다.
 */
export function formatUpdatedAt(updatedAt: string): string {
    return `${updatedAt.slice(5, 10)} ${updatedAt.slice(11, 16)}`;
}
