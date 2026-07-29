import type { BadgeTone } from '@/shared/components/Badge';

/**
 * 이력 화면(대여·반납·정산)과 사용자 통합 이력의 표시 타입.
 *
 * **이 화면들은 전부 P1 이고 확정된 API 가 없습니다.**
 * 화면흐름 §8·§9·§11·§12 는 전부 `ADD_API_CANDIDATE` 이고,
 * API명세 PART C 가 "후보일 뿐 구현 계약이 아니다. Endpoint, HTTP Method,
 * Query Parameter, Request DTO, Response DTO, 상세 오류, 완료 조건을 확정하지 않는다"
 * 고 못 박았습니다. 아래 필드 이름은 전부 잠정값이니 계약이 나오면 맞춰 고치세요.
 *   대여 목록·상세  WEB-API-CAND-002 / 003
 *   반납 목록·상세  WEB-API-CAND-004 / 005
 *   정산 목록·상세  WEB-API-CAND-006 / 007
 *   사용자 통합 이력 WEB-API-CAND-008
 */

/* ------------------------------------------------------------------ 대여 */

/** 화면흐름 §8.1: 연체는 `dueAt`·현재 시각·정산에서 파생하며 신규 RentalStatus 를 만들지 않습니다. */
export type RentalDisplayStatus = 'ACTIVE' | 'OVERDUE' | 'RETURNED' | 'LOST';

export const RENTAL_STATUS_LABEL: Record<RentalDisplayStatus, string> = {
    ACTIVE: '대여중',
    OVERDUE: '연체',
    RETURNED: '반납완료',
    LOST: '분실',
};

export const RENTAL_STATUS_TONE: Record<RentalDisplayStatus, BadgeTone> = {
    ACTIVE: 'blue',
    OVERDUE: 'amber',
    RETURNED: 'green',
    LOST: 'red',
};

export interface Rental {
    /** 개별 우산 ID 는 쓰지 않습니다. 대여 ID 로만 추적합니다 (§3.1 · DEC-028). */
    rentalId: string;
    /** 내부 userId 의 축약 표시. 이름·연락처는 담지 않습니다 (§6.3 · §12). */
    userRef: string;
    stationName: string;
    stationId: string;
    /** 대여가 나간 슬롯 (`checkoutSlotId`) — UUID */
    slotId: string;
    /** 그 슬롯의 사람이 읽는 라벨('SL-03-03'). UUID 만 깔면 어느 슬롯인지 알 수 없습니다. */
    slotLabel: string;
    rentedAt: string;
    dueAt: string;
    status: RentalDisplayStatus;
    /** 이 대여에 연결된 완료 반납. 없으면 null (§8.2 의 1:N 주의) */
    returnAttemptId: string | null;
    settlementId: string | null;
}

/* ------------------------------------------------------------------ 반납 */

export type ReturnDisplayStatus = 'REVIEW_PENDING' | 'REVIEW_DONE' | 'COMPLETED' | 'RECOVERY';

export const RETURN_STATUS_LABEL: Record<ReturnDisplayStatus, string> = {
    REVIEW_PENDING: '검수 대기',
    REVIEW_DONE: '검수 완료',
    COMPLETED: '반납완료',
    RECOVERY: '복구 필요',
};

export const RETURN_STATUS_TONE: Record<ReturnDisplayStatus, BadgeTone> = {
    REVIEW_PENDING: 'amber',
    REVIEW_DONE: 'blue',
    COMPLETED: 'green',
    RECOVERY: 'red',
};

export interface ReturnAttempt {
    returnAttemptId: string;
    rentalId: string;
    userRef: string;
    stationName: string;
    stationId: string;
    /** `returnSlotId` — UUID. 슬롯 미선정이면 null 입니다. */
    slotId: string | null;
    /** 그 슬롯의 표시 라벨. 슬롯 미선정이면 null 입니다. */
    slotLabel: string | null;
    attemptedAt: string;
    status: ReturnDisplayStatus;
    /**
     * AI 보조 결과. 값 집합은 `NORMAL|DAMAGED|UNCERTAIN|FAILED` 입니다 (§17).
     * 시안은 여기에 `ADMIN_REVIEW` 를 적어 놨는데 그건 슬롯 상태라 쓰지 않습니다.
     */
    aiResult: 'NORMAL' | 'DAMAGED' | 'UNCERTAIN' | 'FAILED';
    aiScore: number;
    modelVersion: string;
    latencyMs: number;
    inspectionId: string | null;
    settlementId: string | null;
}

/* ------------------------------------------------------------------ 정산 */

/** 화면흐름 §11.1: 우선순위 `DAMAGE > LOSS > OVERDUE`, 대여 건당 상한 7,000원. */
export type SettlementReason = 'DAMAGE' | 'LOSS' | 'OVERDUE';

export const SETTLEMENT_REASON_LABEL: Record<SettlementReason, string> = {
    DAMAGE: '파손',
    LOSS: '분실',
    OVERDUE: '연체',
};

export const SETTLEMENT_REASON_TONE: Record<SettlementReason, BadgeTone> = {
    DAMAGE: 'red',
    LOSS: 'red',
    OVERDUE: 'amber',
};

export type SettlementStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
    PENDING: '미정산',
    PAID: '정산완료',
    CANCELLED: '취소',
};

export const SETTLEMENT_STATUS_TONE: Record<SettlementStatus, BadgeTone> = {
    PENDING: 'red',
    PAID: 'green',
    CANCELLED: 'slate',
};

export interface Settlement {
    settlementId: string;
    userRef: string;
    reason: SettlementReason;
    /** 서버가 계산한 금액입니다. 클라이언트가 다시 계산하지 않습니다 (§17). */
    amount: number;
    paidAmount: number;
    status: SettlementStatus;
    createdAt: string;
    paidAt: string | null;
    rentalId: string;
    returnAttemptId: string | null;
    slotId: string | null;
    /** 그 슬롯의 표시 라벨. 슬롯이 없으면 null 입니다. */
    slotLabel: string | null;
    /** 파손 판정 사유. 파손 정산이 아니면 null 입니다. */
    decisionReason: string | null;
}

/** `outstandingAmount = amount - paidAmount` (§11.1). 서버 값이 오면 그걸 씁니다. */
export function outstandingOf(settlement: Settlement): number {
    return settlement.amount - settlement.paidAmount;
}

export function formatWon(amount: number): string {
    return `₩${amount.toLocaleString('ko-KR')}`;
}

/* ------------------------------------------- 사용자 통합 이력 (§12) */

export interface UserTimelineEntry {
    at: string;
    kind: '대여' | '반납' | '정산';
    linkId: string;
    to: string;
    target: string;
    statusLabel: string;
    statusTone: BadgeTone;
}
