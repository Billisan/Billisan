import {
    inspectionRefOf,
    rentalUuid,
    returnUuid,
    settlementUuid,
    slotLabelOf,
    slotUuidOf,
    stationUuid,
    userUuid,
    type SlotShapeRequest,
} from '@/features/history/mocks/refs';
import type {
    Rental,
    ReturnAttempt,
    ReturnReviewStatus,
    Settlement,
    UserTimelineEntry,
} from '@/features/history/types';

/**
 * 목업 행이 실제 슬롯 대신 적는 것.
 *
 * `stationId`·`slotId`·`slotLabel`·`inspectionId`·`reviewStatus` 는 여기 적지 않습니다 —
 * 아래 변환부에서 **슬롯 목업을 읽어 파생**시킵니다. 손으로 적던 시절에 없는 슬롯 번호와
 * 실재하지 않는 검수 ID 가 들어갔고, 화면은 그려지는데 대상이 없어서 눌러 보기 전까지
 * 아무도 몰랐습니다.
 */
type RawRow<T> = Omit<T, 'stationId' | 'slotId' | 'slotLabel'> & {
    /** 이 행이 요구하는 슬롯 모양. 슬롯 목업에서 그 상태인 자리를 골라 씁니다. */
    slotShape: SlotShapeRequest | null;
};

/**
 * 반납 행. 검수(`inspectionId`·`reviewStatus`)도 적지 않습니다 — 반납이 들어간 슬롯에
 * 걸린 검수가 곧 그 반납의 검수입니다.
 */
type RawReturn = Omit<
    ReturnAttempt,
    'stationId' | 'slotId' | 'slotLabel' | 'inspectionId' | 'reviewStatus'
> & {
    slotShape: SlotShapeRequest | null;
    /**
     * 슬롯이 없어 검수를 파생할 수 없는 행만 직접 적습니다.
     *
     * ERD §9.2-2 는 AI 결과를 슬롯 배정보다 **먼저** `DAMAGE_INSPECTION` 에 저장하므로
     * 실제 서버에는 슬롯 없는 검수 행이 존재합니다. 이 목업의 검수는 슬롯에서 파생되어
     * 그걸 표현할 수 없으니, 처리 상태만이라도 남겨 둡니다.
     */
    reviewStatus?: ReturnReviewStatus | null;
};

/**
 * 정산 행. 대여소 이름조차 적지 않습니다 — 연결된 반납·대여가 알고 있습니다.
 * 정산은 늘 대여 1건에 붙습니다 (ERD `SETTLEMENT.rental_id`).
 */
type RawSettlement = Omit<Settlement, 'slotId' | 'slotLabel'>;

/**
 * 이력 화면 목업.
 *
 * TODO: 대여·반납·정산·사용자 이력 API 가 확정되면(WEB-API-CAND-002~008) 이 파일을 지우세요.
 *
 * 사용자는 `userRef`(ERD v3.0 `USER_ACCOUNT.user_ref` · 가명 UUID)만 담습니다. 학번인
 * `user_id CHAR(9)` 는 어디에도 넣지 않습니다. 아래 `u_8f3a` 는 목업을 손으로 읽기 쉬우라고
 * 둔 씨앗값이고, `refs.ts` 의 `userUuid()` 가 내보낼 때 UUID 로 바꿉니다 — 화면·링크에
 * 나가는 값은 전부 UUID 입니다.
 *
 * 이름·연락처·대학 계정 식별자·`password_hash` 는 어떤 형태로도 넣지 않습니다 (화면흐름 §6.3).
 */

export const HISTORY_SYNCED_AT = '2026-07-24 09:20';

/** 시안 하단 안내 문구. 우산 ID 없이 대여 ID 로 추적한다는 원칙을 화면에 남깁니다. */
export const RENTAL_LIST_NOTE =
    '대여 상태: 대여중 · 연체(기한 초과 미반납) · 반납완료 · 분실(장기 미반납) · 개별 우산 ID 없이 대여 ID로 추적합니다';

const RAW_RENTALS: RawRow<Rental>[] = [
    {
        /*
         * 반납 시도 `RT-87980` 의 대여.
         *
         * 예전에는 그 반납이 `R-87940`(연체 중인 ACTIVE 대여)을 가리키고 있었습니다.
         * 완료된 반납이 아직 안 돌아온 대여에 붙어 있는 셈이라, 대여 상세에서는 '대여중'
         * 인데 반납 이력에는 같은 대여의 '반납완료' 가 떴습니다. `R-87940` 의 실제 반납
         * 시도는 실패한 `RT-88232` 입니다.
         */
        rentalId: 'R-87960',
        userRef: 'u_9c02',
        stationName: '경영관',
        slotShape: 'EMPTY_SLOT',
        rentedAt: '2026-07-23 18:05',
        dueAt: '2026-07-25 18:05',
        status: 'COMPLETED',
        returnAttemptId: 'RT-87980',
        settlementId: null,
    },
    /*
     * 아래는 반납·정산이 가리키던 대여들입니다. 없으면 '연결 대여' 를 눌러도 빈 화면입니다 —
     * 실제로 그런 상태였습니다. 시각·대여소·사용자를 그 반납/정산과 앞뒤가 맞게 채웠습니다.
     */
    {
        rentalId: 'R-88099',
        userRef: 'u_3a90',
        stationName: '중앙도서관',
        slotShape: 'EMPTY_SLOT',
        rentedAt: '2026-07-23 08:58',
        dueAt: '2026-07-24 08:58',
        status: 'COMPLETED',
        returnAttemptId: 'RT-88205',
        settlementId: null,
    },
    {
        rentalId: 'R-88015',
        userRef: 'u_1f55',
        stationName: '제1공학관',
        slotShape: 'EMPTY_SLOT',
        rentedAt: '2026-07-23 08:47',
        dueAt: '2026-07-24 08:47',
        status: 'ACTIVE',
        returnAttemptId: null,
        settlementId: null,
    },
    {
        rentalId: 'R-88001',
        userRef: 'u_2b71',
        stationName: '정문 광장',
        slotShape: 'EMPTY_SLOT',
        rentedAt: '2026-07-23 08:03',
        dueAt: '2026-07-24 08:03',
        status: 'COMPLETED',
        returnAttemptId: 'RT-88190',
        settlementId: null,
    },
    {
        rentalId: 'R-87988',
        userRef: 'u_4d10',
        stationName: '제1공학관',
        slotShape: 'EMPTY_SLOT',
        rentedAt: '2026-07-23 07:30',
        dueAt: '2026-07-24 07:30',
        status: 'COMPLETED',
        returnAttemptId: 'RT-88180',
        settlementId: null,
    },
    /* 아래 셋은 이미 결제까지 끝난 과거 건입니다 (정산 S-1024 · S-1018 · S-1009). */
    {
        rentalId: 'R-87900',
        userRef: 'u_3a90',
        stationName: '중앙도서관',
        slotShape: 'EMPTY_SLOT',
        rentedAt: '2026-07-21 10:10',
        dueAt: '2026-07-22 10:10',
        status: 'COMPLETED',
        returnAttemptId: 'RT-87905',
        settlementId: 'S-1024',
    },
    {
        rentalId: 'R-87860',
        userRef: 'u_77a0',
        stationName: '자연과학관',
        slotShape: 'EMPTY_SLOT',
        rentedAt: '2026-07-21 17:20',
        dueAt: '2026-07-22 17:20',
        status: 'COMPLETED',
        returnAttemptId: 'RT-87866',
        settlementId: 'S-1018',
    },
    {
        rentalId: 'R-87801',
        userRef: 'u_0b3c',
        stationName: '생활관 A',
        slotShape: 'EMPTY_SLOT',
        rentedAt: '2026-07-20 09:00',
        dueAt: '2026-07-21 09:00',
        status: 'LOST',
        returnAttemptId: null,
        settlementId: 'S-1009',
    },
    /*
     * 아래 두 건은 사용자 통합 이력 타임라인이 가리키는 대여입니다.
     * 목록에 없으면 타임라인에서 눌렀을 때 "존재하지 않는 대여"로 떨어집니다 —
     * 실제로 그런 상태였고, 링크 대상을 목록에 맞춰 넣었습니다.
     */
    {
        rentalId: 'R-87699',
        userRef: 'u_8f3a',
        stationName: '정문 광장',
        slotShape: 'EMPTY_SLOT',
        rentedAt: '2026-07-20 08:15',
        dueAt: '2026-07-21 08:15',
        status: 'COMPLETED',
        returnAttemptId: 'RT-87720',
        settlementId: null,
    },
    {
        rentalId: 'R-87488',
        userRef: 'u_8f3a',
        stationName: '경영관',
        slotShape: 'EMPTY_SLOT',
        rentedAt: '2026-07-18 17:02',
        dueAt: '2026-07-19 17:02',
        status: 'COMPLETED',
        returnAttemptId: 'RT-87510',
        settlementId: null,
    },
    {
        rentalId: 'R-88102',
        userRef: 'u_2210',
        stationName: '제1공학관',
        slotShape: 'EMPTY_SLOT',
        rentedAt: '2026-07-24 09:05',
        dueAt: '2026-07-25 09:05',
        status: 'ACTIVE',
        returnAttemptId: null,
        settlementId: null,
    },
    {
        rentalId: 'R-88098',
        userRef: 'u_2b71',
        stationName: '중앙도서관',
        slotShape: 'EMPTY_SLOT',
        rentedAt: '2026-07-24 08:40',
        dueAt: '2026-07-25 08:40',
        status: 'ACTIVE',
        returnAttemptId: null,
        settlementId: null,
    },
    {
        rentalId: 'R-88021',
        userRef: 'u_8f3a',
        stationName: '제1공학관',
        slotShape: 'EMPTY_SLOT',
        rentedAt: '2026-07-23 14:05',
        dueAt: '2026-07-24 14:05',
        status: 'COMPLETED',
        returnAttemptId: 'RT-88213',
        settlementId: null,
    },
    {
        rentalId: 'R-87940',
        userRef: 'u_9c02',
        stationName: '경영관',
        slotShape: 'EMPTY_SLOT',
        rentedAt: '2026-07-22 11:20',
        dueAt: '2026-07-23 11:20',
        status: 'ACTIVE',
        returnAttemptId: null,
        settlementId: 'S-1039',
    },
    {
        rentalId: 'R-87731',
        userRef: 'u_4d10',
        stationName: '정문 광장',
        slotShape: 'EMPTY_SLOT',
        rentedAt: '2026-07-21 15:40',
        dueAt: '2026-07-22 15:40',
        status: 'LOST',
        returnAttemptId: null,
        settlementId: 'S-1031',
    },
    {
        rentalId: 'R-88010',
        userRef: 'u_77a0',
        stationName: '자연과학관',
        slotShape: 'EMPTY_SLOT',
        rentedAt: '2026-07-23 19:33',
        dueAt: '2026-07-24 19:33',
        status: 'COMPLETED',
        returnAttemptId: 'RT-88055',
        settlementId: null,
    },
    {
        rentalId: 'R-87995',
        userRef: 'u_0b3c',
        stationName: '생활관 A',
        slotShape: 'EMPTY_SLOT',
        rentedAt: '2026-07-23 18:02',
        dueAt: '2026-07-24 18:02',
        status: 'COMPLETED',
        returnAttemptId: 'RT-88208',
        settlementId: 'S-1043',
    },
];

const RAW_RETURNS: RawReturn[] = [
    /*
     * ── 반납이 정상으로 끝나지 않은 세 건 ──────────────────────────────
     *
     * 계약 Enum 은 다섯 개인데(`PROCESSING|PHYSICAL_DONE|COMPLETED|RECOVERY_REQUIRED|FAILED`)
     * 목업이 `COMPLETED` 하나만 쓰고 있어서 「반납 상태」 열이 상수였습니다. 관리자가
     * 이 화면을 보는 이유가 바로 이 세 건이라 실제로 넣습니다.
     */
    {
        /*
         * 복구 필요 — 우산은 들어가 잠겼는데 서버 커밋이 깨진 건.
         *
         * `recoveryScenario.ts` 가 이 슬롯(정문 광장 1번)을 `OUT_OF_SERVICE` 로 격리하므로,
         * 여기서 슬롯 상세로 넘어가면 실제로 격리된 슬롯이 나옵니다.
         * `completedAt` 이 없다는 뜻이라 정산도 붙지 않습니다.
         */
        returnAttemptId: 'RT-88240',
        rentalId: 'R-88098',
        userRef: 'u_2b71',
        stationName: '정문 광장',
        slotShape: 'RECOVERY',
        attemptedAt: '2026-07-24 09:05',
        status: 'RECOVERY_REQUIRED',
        aiResult: 'NORMAL',
        aiScore: 0.05,
        modelVersion: 'v0.4',
        latencyMs: 274,
        settlementId: null,
    },
    {
        /*
         * 물리 완료 — 삽입·잠금까지 확인됐고 최종 반영 대기.
         *
         * 정상 경로의 통과 지점이라 오류가 아닙니다. 다만 여기서 멈춰 있으면 봐야 합니다.
         * ERD §9.2-3 이 "`SLOT.service_status` 는 진행 상태로 바꾸지 않는다" 고 해서
         * 슬롯은 건드리지 않습니다.
         */
        returnAttemptId: 'RT-88238',
        rentalId: 'R-88102',
        userRef: 'u_2210',
        stationName: '경영관',
        slotShape: 'NO_INSPECTION',
        attemptedAt: '2026-07-24 09:18',
        status: 'PHYSICAL_DONE',
        aiResult: 'NORMAL',
        aiScore: 0.07,
        modelVersion: 'v0.4',
        latencyMs: 269,
        settlementId: null,
    },
    {
        /*
         * 실패 — 우산이 안 들어갔음. 사용자가 다시 시도할 수 있습니다.
         *
         * AI 는 이미 돌았고 **판정을 못 냈습니다**(`FAILED`). §9.2-2 가 AI 결과를 슬롯
         * 배정보다 먼저 `DAMAGE_INSPECTION` 에 저장하므로 검수 행은 이미 존재하고,
         * §8.0 이 "`DAMAGED|UNCERTAIN|FAILED` 추론은 ... `ADMIN_REVIEW + UNKNOWN` 로
         * 격리한다" 고 해서 **관리자가 봐야 하는 건**입니다. 그래서 검수는 `PENDING` 입니다.
         * AI 가 못 봤으면 더더욱 사람이 봐야 합니다.
         *
         * 슬롯 선정 전이라 `slotId` 가 `null` 입니다 — ERD §19.3 이 "슬롯 선정 전
         * `PROCESSING`·`FAILED`·`RECOVERY_REQUIRED` 에서는 `return_slot_id` 가 NULL 일 수
         * 있다" 고 허용합니다. AI 도 추론까지 못 가서 `FAILED`(판정 불가)입니다.
         */
        returnAttemptId: 'RT-88232',
        rentalId: 'R-87940',
        userRef: 'u_9c02',
        stationName: '자연과학관',
        slotShape: null,
        // 슬롯이 없어 검수를 파생할 수 없습니다. AI 가 판정을 못 냈으니 사람이 봐야 합니다.
        reviewStatus: 'PENDING',
        attemptedAt: '2026-07-24 08:31',
        status: 'FAILED',
        aiResult: 'FAILED',
        aiScore: null,
        modelVersion: 'v0.4',
        latencyMs: 0,
        settlementId: null,
    },
    /* 결제까지 끝난 과거 정산(S-1024 · S-1018)이 가리키는 반납들. */
    {
        returnAttemptId: 'RT-87905',
        rentalId: 'R-87900',
        userRef: 'u_3a90',
        stationName: '중앙도서관',
        slotShape: 'NO_INSPECTION',
        attemptedAt: '2026-07-23 11:02',
        status: 'COMPLETED',
        aiResult: 'NORMAL',
        aiScore: 0.08,
        modelVersion: 'v0.4',
        latencyMs: 281,
        settlementId: 'S-1024',
    },
    {
        returnAttemptId: 'RT-87866',
        rentalId: 'R-87860',
        userRef: 'u_77a0',
        stationName: '자연과학관',
        slotShape: 'DAMAGED',
        attemptedAt: '2026-07-22 18:33',
        status: 'COMPLETED',
        aiResult: 'DAMAGED',
        aiScore: 0.94,
        modelVersion: 'v0.4',
        latencyMs: 305,
        settlementId: 'S-1018',
    },
    /* 타임라인이 가리키는 반납 두 건. 위 대여 두 건과 짝입니다. */
    {
        returnAttemptId: 'RT-87720',
        rentalId: 'R-87699',
        userRef: 'u_8f3a',
        stationName: '정문 광장',
        slotShape: 'NO_INSPECTION',
        attemptedAt: '2026-07-20 10:30',
        status: 'COMPLETED',
        aiResult: 'NORMAL',
        aiScore: 0.06,
        modelVersion: 'v0.4',
        latencyMs: 288,
        settlementId: null,
    },
    {
        returnAttemptId: 'RT-87510',
        rentalId: 'R-87488',
        userRef: 'u_8f3a',
        stationName: '경영관',
        slotShape: 'NO_INSPECTION',
        attemptedAt: '2026-07-18 19:40',
        status: 'COMPLETED',
        aiResult: 'NORMAL',
        aiScore: 0.04,
        modelVersion: 'v0.4',
        latencyMs: 301,
        settlementId: null,
    },
    {
        returnAttemptId: 'RT-88213',
        rentalId: 'R-88021',
        userRef: 'u_8f3a',
        stationName: '제1공학관',
        slotShape: 'ADMIN_REVIEW',
        attemptedAt: '2026-07-24 09:12',
        status: 'COMPLETED',
        aiResult: 'DAMAGED',
        aiScore: 0.92,
        modelVersion: 'v0.4',
        latencyMs: 320,
        settlementId: null,
    },
    {
        returnAttemptId: 'RT-88205',
        rentalId: 'R-88099',
        userRef: 'u_3a90',
        stationName: '중앙도서관',
        slotShape: 'ADMIN_REVIEW',
        attemptedAt: '2026-07-24 08:58',
        status: 'COMPLETED',
        aiResult: 'DAMAGED',
        aiScore: 0.88,
        modelVersion: 'v0.4',
        latencyMs: 296,
        settlementId: null,
    },
    {
        returnAttemptId: 'RT-88208',
        rentalId: 'R-87995',
        userRef: 'u_0b3c',
        stationName: '생활관 A',
        slotShape: 'DAMAGED',
        attemptedAt: '2026-07-24 08:47',
        status: 'COMPLETED',
        aiResult: 'DAMAGED',
        aiScore: 0.92,
        modelVersion: 'v0.4',
        latencyMs: 311,
        settlementId: 'S-1043',
    },
    {
        returnAttemptId: 'RT-87980',
        rentalId: 'R-87960',
        userRef: 'u_9c02',
        stationName: '경영관',
        slotShape: 'ADMIN_REVIEW',
        attemptedAt: '2026-07-24 08:20',
        status: 'COMPLETED',
        aiResult: 'UNCERTAIN',
        aiScore: 0.54,
        modelVersion: 'v0.4',
        latencyMs: 402,
        settlementId: null,
    },
    {
        returnAttemptId: 'RT-88190',
        rentalId: 'R-88001',
        userRef: 'u_2b71',
        stationName: '정문 광장',
        slotShape: 'NO_INSPECTION',
        attemptedAt: '2026-07-24 08:03',
        status: 'COMPLETED',
        aiResult: 'NORMAL',
        aiScore: 0.97,
        modelVersion: 'v0.4',
        latencyMs: 274,
        settlementId: null,
    },
    {
        returnAttemptId: 'RT-88180',
        rentalId: 'R-87988',
        userRef: 'u_4d10',
        stationName: '빌리대역 출구',
        slotShape: 'ADMIN_REVIEW',
        attemptedAt: '2026-07-24 07:46',
        status: 'COMPLETED',
        aiResult: 'DAMAGED',
        aiScore: 0.81,
        modelVersion: 'v0.4',
        latencyMs: 338,
        settlementId: null,
    },
    {
        returnAttemptId: 'RT-88055',
        rentalId: 'R-88010',
        // 연결 대여(R-88010)와 같은 사람이어야 합니다. 어긋나 있어서 대여 상세와 반납
        // 상세가 서로 다른 사용자를 보여 줬습니다.
        userRef: 'u_77a0',
        // 대여는 자연과학관, 반납은 생활관 A — 다른 대여소에 반납하는 정상 경로입니다.
        stationName: '생활관 A',
        slotShape: 'REVIEWED_NORMAL',
        attemptedAt: '2026-07-23 21:03',
        status: 'COMPLETED',
        /*
         * AI 오탐 케이스. AI 는 파손을 의심했지만 관리자가 이상 없음으로 뒤집었습니다.
         * 그래서 검수는 `DECIDED` 이고 정산은 붙지 않습니다. 슬롯 목업의
         * `REVIEWED_NORMAL` 프리셋과 같은 상황입니다.
         */
        aiResult: 'DAMAGED',
        aiScore: 0.86,
        modelVersion: 'v0.4',
        latencyMs: 281,
        settlementId: null,
    },
];

const RAW_SETTLEMENTS: RawSettlement[] = [
    {
        settlementId: 'S-1043',
        userRef: 'u_0b3c',
        reason: 'DAMAGE',
        amount: 7000,
        paidAmount: 0,
        status: 'PENDING',
        createdAt: '2026-07-24 09:20',
        paidAt: null,
        rentalId: 'R-87995',
        returnAttemptId: 'RT-88208',
        decisionReason: '캐노피 찢어짐',
    },
    {
        settlementId: 'S-1039',
        userRef: 'u_9c02',
        reason: 'OVERDUE',
        amount: 1000,
        paidAmount: 0,
        status: 'PENDING',
        createdAt: '2026-07-24 07:41',
        paidAt: null,
        rentalId: 'R-87940',
        returnAttemptId: null,
        decisionReason: null,
    },
    {
        settlementId: 'S-1031',
        userRef: 'u_4d10',
        reason: 'LOSS',
        amount: 7000,
        paidAmount: 0,
        status: 'PENDING',
        createdAt: '2026-07-23 15:20',
        paidAt: null,
        rentalId: 'R-87731',
        returnAttemptId: null,
        decisionReason: null,
    },
    {
        settlementId: 'S-1024',
        userRef: 'u_3a90',
        reason: 'OVERDUE',
        amount: 1000,
        paidAmount: 1000,
        status: 'PAID',
        createdAt: '2026-07-23 11:02',
        paidAt: '2026-07-23 11:40',
        rentalId: 'R-87900',
        returnAttemptId: 'RT-87905',
        decisionReason: null,
    },
    {
        settlementId: 'S-1018',
        userRef: 'u_77a0',
        reason: 'DAMAGE',
        amount: 7000,
        paidAmount: 7000,
        status: 'PAID',
        createdAt: '2026-07-22 18:33',
        paidAt: '2026-07-22 19:02',
        rentalId: 'R-87860',
        returnAttemptId: 'RT-87866',
        decisionReason: '살대 파손',
    },
    {
        settlementId: 'S-1009',
        userRef: 'u_0b3c',
        reason: 'LOSS',
        amount: 7000,
        paidAmount: 7000,
        status: 'PAID',
        createdAt: '2026-07-22 09:15',
        paidAt: '2026-07-22 10:31',
        rentalId: 'R-87801',
        returnAttemptId: null,
        decisionReason: null,
    },
];

/*
 * ---------------------------------------------------------------- UUID 변환
 *
 * 위 데이터는 읽기 쉬우라고 `R-88102`·`ST-003`·`SL-03-03` 같은 표시 코드로 적었습니다.
 * 실제 서버는 전부 `CHAR(36)` UUID 를 줍니다 (ERD). 그 차이를 나중에 메우면 화면·검색·링크를
 * 다시 손대야 하므로, **내보내는 시점에 UUID 로 바꿔** 지금부터 실제 모양으로 다룹니다.
 *
 * 슬롯·검수 목업과 같은 네임스페이스를 써서 화면끼리 ID 가 이어집니다. 슬롯 상세의
 * `연결 반납 시도` 가 가리키는 값이 반납 이력의 그 건과 실제로 같은 UUID 입니다.
 *
 * 사람이 읽던 코드는 버리지 않고 `slotLabel` 로 남깁니다 — 표에 UUID 만 깔면 어느 슬롯인지
 * 알 수 없습니다.
 */
/** 요청한 모양의 슬롯을 실제로 집어 UUID·표시 라벨을 함께 만듭니다. */
function resolveSlot(stationName: string, shape: SlotShapeRequest | null) {
    if (!shape) return { slotId: null, slotLabel: null };
    return {
        slotId: slotUuidOf(stationName, shape),
        slotLabel: slotLabelOf(stationName, shape),
    };
}

export const MOCK_RENTALS: Rental[] = RAW_RENTALS.map(({ slotShape, ...item }) => ({
    ...item,
    ...resolveSlot(item.stationName, slotShape),
    userRef: userUuid(item.userRef),
    rentalId: rentalUuid(item.rentalId),
    stationId: stationUuid(item.stationName),
    returnAttemptId: item.returnAttemptId && returnUuid(item.returnAttemptId),
    settlementId: item.settlementId && settlementUuid(item.settlementId),
})) as Rental[];

/**
 * 반납 행.
 *
 * **검수는 손으로 적지 않고 슬롯에서 파생합니다.** 반납이 들어간 슬롯에 걸린 검수가 곧
 * 그 반납의 검수입니다 — 그래야 반납 상세에서 검수로 넘어갔을 때 실재하는 검수가 나오고,
 * 검수 처리 상태도 슬롯 상태와 어긋나지 않습니다.
 *
 * 슬롯이 없는 반납(선정 전 실패)은 검수 ID 를 만들 수 없습니다. ERD §9.2-2 는 AI 결과를
 * 슬롯 배정보다 먼저 저장하므로 실제 서버에는 슬롯 없는 검수 행이 존재하지만, 이 목업의
 * 검수는 슬롯에서 파생되므로 표현할 수 없습니다. 그 대신 `reviewStatus` 는 행에 적힌
 * 값을 그대로 씁니다 — AI 가 판정을 못 낸 건은 사람이 봐야 하는 게 맞습니다.
 */
export const MOCK_RETURNS: ReturnAttempt[] = RAW_RETURNS.map(({ slotShape, ...item }) => {
    const inspection = slotShape && inspectionRefOf(item.stationName, slotShape);

    return {
        ...item,
        ...resolveSlot(item.stationName, slotShape),
        userRef: userUuid(item.userRef),
        returnAttemptId: returnUuid(item.returnAttemptId),
        rentalId: rentalUuid(item.rentalId),
        stationId: stationUuid(item.stationName),
        inspectionId: inspection?.inspectionId ?? null,
        reviewStatus: inspection?.reviewStatus ?? item.reviewStatus ?? null,
        settlementId: item.settlementId && settlementUuid(item.settlementId),
    };
}) as ReturnAttempt[];

/**
 * 정산의 슬롯은 **연결된 반납·대여에서 가져옵니다.**
 *
 * 파손 정산의 슬롯은 파손이 발견된 자리, 즉 그 반납이 들어간 슬롯입니다. 분실 정산은
 * 반납이 없으니 우산이 나간 자리, 즉 대여의 인출 슬롯입니다. 예전에는 정산 행에도 슬롯
 * 코드를 따로 적어 뒀는데, 반납이 가리키는 슬롯과 다른 값이 되어 같은 사건의 슬롯이
 * 화면마다 달랐습니다.
 */
function slotOfSettlement(item: RawSettlement) {
    const attempt = item.returnAttemptId
        ? RAW_RETURNS.find((row) => row.returnAttemptId === item.returnAttemptId)
        : undefined;
    const rental = RAW_RENTALS.find((row) => row.rentalId === item.rentalId);
    const source = attempt ?? rental;

    return source
        ? resolveSlot(source.stationName, source.slotShape)
        : { slotId: null, slotLabel: null };
}

export const MOCK_SETTLEMENTS: Settlement[] = RAW_SETTLEMENTS.map((item) => ({
    ...item,
    ...slotOfSettlement(item),
    userRef: userUuid(item.userRef),
    settlementId: settlementUuid(item.settlementId),
    rentalId: rentalUuid(item.rentalId),
    returnAttemptId: item.returnAttemptId && returnUuid(item.returnAttemptId),
})) as Settlement[];

export function findRental(id: string | undefined) {
    return MOCK_RENTALS.find((item) => item.rentalId === id);
}

export function findReturn(id: string | undefined) {
    return MOCK_RETURNS.find((item) => item.returnAttemptId === id);
}

export function findSettlement(id: string | undefined) {
    return MOCK_SETTLEMENTS.find((item) => item.settlementId === id);
}

/* ------------------------------------------- 사용자 통합 이력 (§12) */

export interface UserSummary {
    userRef: string;
    /** 각 집계의 기간을 함께 밝힙니다 (§12). */
    period: string;
    totalRentals: number;
    normalReturns: number;
    damagedOrLost: number;
    outstandingAmount: number;
    timeline: UserTimelineEntry[];
}

const RAW_USER: UserSummary = {
    userRef: 'u_8f3a',
    period: '최근 30일',
    totalRentals: 8,
    normalReturns: 6,
    damagedOrLost: 1,
    outstandingAmount: 7000,
    timeline: [
        {
            at: '2026-07-24 09:20',
            kind: '정산',
            linkId: 'S-1043',
            to: '/history/settlements/S-1043',
            target: '파손 · ₩7,000',
            statusLabel: '미정산',
            statusTone: 'red',
        },
        {
            at: '2026-07-24 09:12',
            kind: '반납',
            linkId: 'RT-88213',
            to: '/history/returns/RT-88213',
            target: '제1공학관 · SL-03-07',
            statusLabel: '검수 대기',
            statusTone: 'amber',
        },
        {
            at: '2026-07-23 14:05',
            kind: '대여',
            linkId: 'R-88021',
            to: '/history/rentals/R-88021',
            target: '제1공학관 · SL-03-07',
            statusLabel: '반납완료',
            statusTone: 'green',
        },
        {
            at: '2026-07-20 10:30',
            kind: '반납',
            linkId: 'RT-87720',
            to: '/history/returns/RT-87720',
            target: '정문 광장 · SL-01-05',
            statusLabel: '반납완료',
            statusTone: 'green',
        },
        {
            at: '2026-07-20 08:15',
            kind: '대여',
            linkId: 'R-87699',
            to: '/history/rentals/R-87699',
            target: '정문 광장 · SL-01-05',
            statusLabel: '반납완료',
            statusTone: 'green',
        },
        {
            at: '2026-07-18 19:40',
            kind: '반납',
            linkId: 'RT-87510',
            to: '/history/returns/RT-87510',
            target: '경영관 · SL-05-02',
            statusLabel: '반납완료',
            statusTone: 'green',
        },
        {
            at: '2026-07-18 17:02',
            kind: '대여',
            linkId: 'R-87488',
            to: '/history/rentals/R-87488',
            target: '경영관 · SL-05-02',
            statusLabel: '반납완료',
            statusTone: 'green',
        },
    ],
};

/** 타임라인의 링크도 같은 규칙으로 바꿉니다. 안 바꾸면 눌러도 없는 화면으로 갑니다. */
export const MOCK_USER: UserSummary = {
    ...RAW_USER,
    userRef: userUuid(RAW_USER.userRef),
    timeline: RAW_USER.timeline.map((entry) => {
        const id =
            entry.kind === '대여'
                ? rentalUuid(entry.linkId)
                : entry.kind === '반납'
                  ? returnUuid(entry.linkId)
                  : settlementUuid(entry.linkId);
        const path =
            entry.kind === '대여' ? 'rentals' : entry.kind === '반납' ? 'returns' : 'settlements';

        return { ...entry, linkId: id, to: `/history/${path}/${id}` };
    }),
};
