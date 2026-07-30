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

/**
 * 서버가 주는 대여 상태. ERD §8.0 「업무 DB Enum」 그대로입니다.
 *
 * ```
 * RentalStatus: REQUESTED | ACTIVE | RETURNING | COMPLETED | LOST | CANCELLED | FAILED
 * ```
 *
 * **`RETURNED` 는 없는 값입니다.** 반납 완료는 `COMPLETED` 입니다 — 12-R 전체에 `RETURNED`
 * 가 한 번도 안 나오고, 확정 계약인 `RENTAL-002` 의 조회 필터도 `ALL|ACTIVE|COMPLETED|
 * LOST|FAILED` 입니다. 화면흐름 §8.2 의 `Variant: ACTIVE, RETURNED, LOST` 한 줄만 다르게
 * 적혀 있는데, 그건 화면 변형 표기이지 DB Enum 정의가 아닙니다.
 */
export type RentalStatus =
    'REQUESTED' | 'ACTIVE' | 'RETURNING' | 'COMPLETED' | 'LOST' | 'CANCELLED' | 'FAILED';

/**
 * 화면에 찍는 상태. 서버 상태에 **연체 하나를 얹은** 값입니다.
 *
 * 연체는 상태가 아닙니다. ERD 에서 `OVERDUE` 는 `SettlementReason`(정산 사유)이고,
 * 화면흐름 §8.1 이 못 박았습니다 — "연체는 `dueAt`과 현재 시각·정산 상태에서 파생될 수
 * 있으며 **신규 RentalStatus 를 추가하지 않는다**".
 *
 * 그래서 서버로 보내거나 서버에서 받는 값에는 절대 `OVERDUE` 를 쓰지 않고, 배지 글자를
 * 고를 때만 씁니다.
 */
export type RentalDisplayStatus = RentalStatus | 'OVERDUE';

export const RENTAL_STATUS_LABEL: Record<RentalDisplayStatus, string> = {
    REQUESTED: '요청됨',
    ACTIVE: '대여중',
    RETURNING: '반납중',
    COMPLETED: '반납완료',
    LOST: '분실',
    CANCELLED: '취소',
    FAILED: '실패',
    OVERDUE: '연체',
};

export const RENTAL_STATUS_TONE: Record<RentalDisplayStatus, BadgeTone> = {
    REQUESTED: 'slate',
    ACTIVE: 'blue',
    RETURNING: 'blue',
    COMPLETED: 'green',
    LOST: 'red',
    CANCELLED: 'slate',
    FAILED: 'red',
    OVERDUE: 'amber',
};

/**
 * 배지에 찍을 상태 하나를 고릅니다.
 *
 * 대여 중인데 기한이 지났으면 `연체` 로 덮습니다. 관리자에게는 "대여중"보다 "연체"가
 * 먼저 보여야 할 정보라서요. 그 외에는 서버 값을 그대로 씁니다.
 *
 * 기준 시각을 인자로 받습니다. `new Date()` 를 안에서 부르면 목업 데이터(2026-07-24 기준)와
 * 실제 시각이 어긋나 전부 연체로 보입니다. 서버가 붙으면 응답의 `asOf` 를 넘기세요 —
 * 화면흐름 §17 이 "서버 `dueAt,asOf`" 를 쓰라고 했습니다.
 */
export function rentalDisplayStatus(rental: Rental, asOf: string): RentalDisplayStatus {
    if (rental.status === 'ACTIVE' && rental.dueAt && rental.dueAt < asOf) return 'OVERDUE';
    return rental.status;
}

export interface Rental {
    /** 개별 우산 ID 는 쓰지 않습니다. 대여 ID 로만 추적합니다 (§3.1 · DEC-028). */
    rentalId: string;
    /**
     * `USER_ACCOUNT.user_ref` (ERD v3.0 §7.1) — `CHAR(36)` **가명 UUID**.
     *
     * **`user_id` 를 쓰면 안 됩니다.** v3.0 에서 두 컬럼이 갈렸습니다.
     * ```
     * user_id   CHAR(9)   PK · CHECK 9 DIGITS    정확히 9자리 숫자 학번
     * user_ref  CHAR(36)  UNIQUE · UUID CHECK    Spring 생성 무작위 가명 UUID.
     *                                            학번에서 유도 금지
     * ```
     * 학번은 그 자체로 직접 식별 정보입니다. 화면흐름 §6.3 이 마스킹하라고 한
     * "대학 계정 식별자" 가 이것이라, 관리자 화면에는 가명키만 올립니다.
     *
     * v2.1 ERD 에서는 `user_id` 가 `CHAR(36)` UUID 였습니다. 그 기준으로 이 필드를 한때
     * `userId` 로 바꿨다가 v3.0 을 보고 되돌렸습니다 — 그대로 뒀으면 서버를 붙이는 순간
     * 학번이 화면으로 올라옵니다.
     *
     * 화면에는 축약해서 보여 줍니다 (화면흐름 §12).
     */
    userRef: string;
    stationName: string;
    stationId: string;
    /** 대여가 나간 슬롯 (`checkoutSlotId`) — UUID */
    slotId: string;
    /** 그 슬롯의 사람이 읽는 라벨('SL-03-03'). UUID 만 깔면 어느 슬롯인지 알 수 없습니다. */
    slotLabel: string;
    rentedAt: string;
    dueAt: string;
    /** 서버 값 그대로입니다. 연체는 여기 없고 `rentalDisplayStatus()` 가 파생합니다. */
    status: RentalStatus;
    /** 이 대여에 연결된 완료 반납. 없으면 null (§8.2 의 1:N 주의) */
    returnAttemptId: string | null;
    settlementId: string | null;
}

/* ------------------------------------------------------------------ 반납 */

/**
 * 반납 시도 상태. ERD §8.0 「업무 DB Enum」 그대로입니다.
 *
 * ```
 * ReturnAttemptStatus: PROCESSING | PHYSICAL_DONE | COMPLETED | RECOVERY_REQUIRED | FAILED
 * ```
 *
 * **`REVIEW_PENDING`·`REVIEW_DONE` 은 없는 값이었습니다.** 그건 반납 상태가 아니라
 * **검수 처리 상태**(`ReviewStatus: PENDING | DECIDED`)인데 한 칸에 섞여 있었습니다.
 * `RECOVERY` 도 계약 값은 `RECOVERY_REQUIRED` 입니다.
 *
 * 화면흐름 §9.1 도 `status` · `InspectionResult` · `검수 처리 상태` 를 **세 개 따로**
 * 표시하라고 합니다. 섞으면 "반납은 끝났고 검수만 남았다"와 "반납 자체가 안 끝났다"를
 * 구분할 수 없습니다.
 */
export type ReturnAttemptStatus =
    'PROCESSING' | 'PHYSICAL_DONE' | 'COMPLETED' | 'RECOVERY_REQUIRED' | 'FAILED';

export const RETURN_STATUS_LABEL: Record<ReturnAttemptStatus, string> = {
    PROCESSING: '처리 중',
    // 우산 삽입과 실제 잠금까지 끝난 물리 완료. 서버 반영은 아직입니다 (ERD §8.0).
    PHYSICAL_DONE: '물리 완료',
    COMPLETED: '반납완료',
    RECOVERY_REQUIRED: '복구 필요',
    FAILED: '실패',
};

export const RETURN_STATUS_TONE: Record<ReturnAttemptStatus, BadgeTone> = {
    PROCESSING: 'blue',
    PHYSICAL_DONE: 'blue',
    COMPLETED: 'green',
    RECOVERY_REQUIRED: 'red',
    FAILED: 'red',
};

/**
 * 관리자 검수 처리 상태. 반납 상태와 **다른 축**입니다 (`ADMIN-INSPECTION-001` 의
 * `reviewStatus`). 검수가 걸리지 않은 반납은 `null` 입니다 — AI 가 정상으로 본 반납은
 * 관리자 검수로 넘어오지 않습니다.
 */
export type ReturnReviewStatus = 'PENDING' | 'DECIDED';

export const REVIEW_STATUS_LABEL: Record<ReturnReviewStatus, string> = {
    PENDING: '미처리',
    DECIDED: '처리 완료',
};

export const REVIEW_STATUS_TONE: Record<ReturnReviewStatus, BadgeTone> = {
    PENDING: 'amber',
    DECIDED: 'blue',
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
    /** 반납 자체가 어디까지 갔는지. 검수와 섞지 않습니다. */
    status: ReturnAttemptStatus;
    /**
     * AI 보조 결과. 값 집합은 `NORMAL|DAMAGED|UNCERTAIN|FAILED` 입니다 (§17).
     * 시안은 여기에 `ADMIN_REVIEW` 를 적어 놨는데 그건 슬롯 상태라 쓰지 않습니다.
     */
    aiResult: 'NORMAL' | 'DAMAGED' | 'UNCERTAIN' | 'FAILED';
    aiScore: number;
    modelVersion: string;
    latencyMs: number;
    inspectionId: string | null;
    /** 검수가 걸린 반납만 값이 있습니다. 반납 상태와 별개 축입니다. */
    reviewStatus: ReturnReviewStatus | null;
    /**
     * 파손 정산.
     *
     * **검수가 `PENDING` 이면 반드시 `null` 입니다.** ERD §8.0 이
     * "`DAMAGED | UNCERTAIN | FAILED` 추론은 자동 파손 확정이나 **자동 과금이 아니다**",
     * `EDGE-INSPECT-001` 이 "메타데이터만 저장; **자동 과금 금지**" 라고 못 박았고,
     * 파손 정산은 `ADMIN-INSPECTION-003` 이 `DAMAGED` 로 판정할 때 생깁니다.
     * AI 점수만으로 돈을 물리면 계약 위반입니다.
     */
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
