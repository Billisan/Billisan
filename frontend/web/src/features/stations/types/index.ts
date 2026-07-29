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
 * TODO: 운영 정책 확정되면 대여소별 설정값으로 빼세요.
 */
export const STOCK_THRESHOLD = {
    /** 이 값 이상이면 과잉 */
    surplus: 40,
    /** 이 값 이상이면 적정, 미만이면 부족 */
    normal: 20,
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
export type SlotItemCondition = 'EMPTY' | 'NORMAL' | 'DAMAGED' | 'REPAIRABLE' | 'UNKNOWN';
export type LockStatus = 'LOCKED' | 'UNLOCKED' | 'UNKNOWN' | 'ERROR';

/** 슬롯에 걸린 검수. 미처리(PENDING)면 표에 '검수 대기'로 나옵니다. */
export interface SlotInspection {
    /** ERD `DAMAGE_INSPECTION.inspection_id` — UUID */
    inspectionId: string;
    reviewStatus: 'PENDING' | 'DECIDED';
}

/**
 * ERD `SLOT`.
 *
 * 신원은 `slotId`(UUID)이고, 사람이 부르는 번호는 `slotNumber`(`UNIQUE(station_id, slot_number)`)입니다.
 * 'SL-03-01' 같은 코드 컬럼은 ERD 에 없습니다 — `stationCode` + `slotNumber` 로 만드는 표시 라벨입니다.
 */
export interface Slot {
    /** ERD PK. 라우트·API 에 쓰는 진짜 신원입니다. */
    slotId: string;
    /** ERD FK */
    stationId: string;
    /** `slot_number INT` — 대여소 안에서의 물리 번호 */
    slotNumber: number;
    occupancyStatus: SlotOccupancyStatus;
    serviceStatus: SlotServiceStatus;
    /**
     * 비어 있는 슬롯의 값이 문서마다 다릅니다.
     *   ERD  — `item_condition NOT NULL`, `occupancy=EMPTY ⇔ item_condition=EMPTY`
     *   API  — "`occupancyStatus = EMPTY` 이면 `itemCondition = null`"
     * 어느 쪽이 와도 되게 null 을 허용하고, 화면에서는 null 을 `EMPTY` 와 같게 봅니다.
     * TODO: 백엔드 담당자 확인 후 한쪽으로 좁히세요.
     */
    itemCondition: SlotItemCondition | null;
    lockStatus: LockStatus;
    /**
     * 이 슬롯에 걸린 활성 대여. '대여 중'은 슬롯 Enum 이 아니라 RENTAL 연결에서 파생합니다
     * (GAP-WEB-005 · WF-WEB-CHANGE-005).
     */
    activeRentalId: string | null;
    inspection: SlotInspection | null;
    /**
     * 서버 updatedAt 원문. DATETIME(6) 마이크로초라서 Date 로 파싱했다가 다시 만들면
     * 자릿수가 잘려 expectedUpdatedAt CAS 가 항상 409 가 됩니다. 문자열 그대로 보관하세요.
     */
    updatedAt: string;
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
    'AVAILABLE' | 'RENTED' | 'EMPTY' | 'DAMAGED' | 'ADMIN_REVIEW' | 'OUT_OF_SERVICE' | 'UNKNOWN';

/** 4축 + 대여 연결 → 표시용 상태 하나 (화면흐름 §17 매핑표) */
export function deriveSlotDisplayStatus(slot: Slot): SlotDisplayStatus {
    if (slot.activeRentalId) return 'RENTED';
    if (slot.serviceStatus === 'ADMIN_REVIEW') return 'ADMIN_REVIEW';
    if (slot.itemCondition === 'DAMAGED' || slot.itemCondition === 'REPAIRABLE') return 'DAMAGED';
    if (slot.serviceStatus === 'OUT_OF_SERVICE') return 'OUT_OF_SERVICE';
    // ERD 는 EMPTY, API 는 null 을 쓴다고 해서 둘 다 빈 슬롯으로 봅니다.
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
    RENTED: 'blue',
    EMPTY: 'slate',
    DAMAGED: 'red',
    ADMIN_REVIEW: 'amber',
    OUT_OF_SERVICE: 'slate',
    UNKNOWN: 'slate',
};

/** 검수 상세로 넘길 수 있는 슬롯인지 (미처리 검수가 걸려 있는 경우) */
export function pendingInspectionId(slot: Slot): string | null {
    return slot.inspection?.reviewStatus === 'PENDING' ? slot.inspection.inspectionId : null;
}

/**
 * 서버 updatedAt(마이크로초 포함)을 표의 'MM-DD HH:mm' 로 자릅니다.
 * Date 로 파싱하지 않고 문자열만 잘라서 원문을 보존합니다.
 */
export function formatUpdatedAt(updatedAt: string): string {
    return `${updatedAt.slice(5, 10)} ${updatedAt.slice(11, 16)}`;
}
