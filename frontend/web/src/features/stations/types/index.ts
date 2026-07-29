import type { BadgeTone } from '@/shared/components/Badge';
import {
    AI_RESULT_LABEL,
    DECISION_LABEL,
    SLOT_DISPLAY_LABEL,
    withCode,
} from '@/shared/constants/statusLabels';

/* ------------------------------------------------------------------ 대여소 */

/**
 * ERD `STATION`.
 *
 * **신원은 `stationId`(UUID)입니다.** `stationCode`('ST-003')는 외부·장치 식별용 표시 코드라
 * 화면에만 씁니다. API 경로(`/stations/{stationId}/slots`)에는 UUID 가 들어갑니다.
 *
 * ERD 컬럼: `station_id CHAR(36) PK` · `station_code VARCHAR(50) UNIQUE` · `name` ·
 *           `location_text` · `service_status` · `device_status` · `current_boot_id` ·
 *           `boot_synced_at` · `last_seen_at` · `updated_at`
 */
export type StationServiceStatus = 'AVAILABLE' | 'MAINTENANCE' | 'OFFLINE';
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'ERROR';

export interface Station {
    /** ERD PK. 라우트·API 에 쓰는 진짜 신원입니다. */
    stationId: string;
    /** `station_code` — 'ST-003'. 표시·장치 식별용입니다. */
    stationCode: string;
    /** `name` — '제1공학관' */
    name: string;
    /** `location_text` — MVP 간이 위치 표시. 좌표가 아닙니다. */
    locationText: string | null;
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
 * 재고 상태 임계값 (대여 가능 수량 기준).
 *
 * 대여소당 SLOT 이 3~5개라 임계값도 그 규모입니다 (상위 기획 §4.1).
 * TODO: 운영 정책 확정되면 대여소별 설정값으로 빼세요.
 */
export const STOCK_THRESHOLD = {
    /** 이 값 이상이면 과잉 */
    surplus: 4,
    /** 이 값 이상이면 적정, 미만이면 부족 */
    normal: 2,
} as const;

export function getStationStatus(station: Station): StationStatus {
    if (!isDeviceOnline(station)) return 'OFFLINE';
    if (station.available >= STOCK_THRESHOLD.surplus) return 'SURPLUS';
    if (station.available >= STOCK_THRESHOLD.normal) return 'NORMAL';
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
 * 'SL-03-01' 같은 코드 컬럼도 없습니다 — `stationCode` + `slotNumber` 로 만드는 표시 라벨입니다.
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
    status: string;
}

/** `ADMIN-SLOT-DETAIL-001` 의 `latestInspection` */
export interface SlotInspectionRef {
    inspectionId: string;
    aiResult: AiInspectionResult;
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
 * 표시용 슬롯 라벨. 'ST-003' + 1 → 'SL-03-01'.
 *
 * DB 에 이런 컬럼은 없습니다. 화면에서만 쓰고, 검색·라우팅에는 쓰지 마세요.
 */
export function formatSlotLabel(stationCode: string, slotNumber: number): string {
    const stationSeq = stationCode.replace(/\D/g, '').slice(-2).padStart(2, '0');
    return `SL-${stationSeq}-${String(slotNumber).padStart(2, '0')}`;
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
export function deriveSlotDisplayStatus(slot: SlotSummary): SlotDisplayStatus {
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

/** 파생 상태 → `이용 가능(AVAILABLE)` 형태의 표시 문자열 (ERD §2.4.1) */
export function slotStatusText(status: SlotDisplayStatus): string {
    return withCode(SLOT_DISPLAY_LABEL, status);
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

/** AI 결과 → `파손 의심(DAMAGED)` */
export function aiResultText(result: AiInspectionResult): string {
    return withCode(AI_RESULT_LABEL, result);
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

/** 관리자 판정 → `관리자 파손 판정(DAMAGED)` */
export function decisionText(decision: InspectionDecision): string {
    return withCode(DECISION_LABEL, decision);
}

export const SLOT_DISPLAY_TONE: Record<SlotDisplayStatus, BadgeTone> = {
    AVAILABLE: 'green',
    EMPTY: 'slate',
    DAMAGED: 'red',
    ADMIN_REVIEW: 'amber',
    OUT_OF_SERVICE: 'slate',
    UNKNOWN: 'slate',
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
