import {
    rentalUuid,
    returnUuid,
    settlementUuid,
    slotLabelOf,
    slotUuidOf,
    stationUuid,
    userUuid,
} from '@/features/history/mocks/refs';
import type {
    Rental,
    ReturnAttempt,
    Settlement,
    UserTimelineEntry,
} from '@/features/history/types';

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

const RAW_RENTALS: Omit<Rental, 'slotLabel'>[] = [
    /*
     * 아래는 반납·정산이 가리키던 대여들입니다. 없으면 '연결 대여' 를 눌러도 빈 화면입니다 —
     * 실제로 그런 상태였습니다. 시각·대여소·사용자를 그 반납/정산과 앞뒤가 맞게 채웠습니다.
     */
    {
        rentalId: 'R-88099',
        userRef: 'u_3a90',
        stationName: '중앙도서관',
        stationId: 'ST-002',
        slotId: 'SL-02-11',
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
        stationId: 'ST-003',
        slotId: 'SL-03-06',
        rentedAt: '2026-07-23 08:47',
        dueAt: '2026-07-24 08:47',
        status: 'COMPLETED',
        returnAttemptId: null,
        settlementId: null,
    },
    {
        rentalId: 'R-88001',
        userRef: 'u_2b71',
        stationName: '정문 광장',
        stationId: 'ST-001',
        slotId: 'SL-01-08',
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
        stationId: 'ST-003',
        slotId: 'SL-03-04',
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
        stationId: 'ST-002',
        slotId: 'SL-02-03',
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
        stationId: 'ST-006',
        slotId: 'SL-06-04',
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
        stationId: 'ST-007',
        slotId: 'SL-07-01',
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
        stationId: 'ST-001',
        slotId: 'SL-01-05',
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
        stationId: 'ST-005',
        slotId: 'SL-05-02',
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
        stationId: 'ST-003',
        slotId: 'SL-03-03',
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
        stationId: 'ST-002',
        slotId: 'SL-02-05',
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
        stationId: 'ST-003',
        slotId: 'SL-03-07',
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
        stationId: 'ST-005',
        slotId: 'SL-05-03',
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
        stationId: 'ST-001',
        slotId: 'SL-01-02',
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
        stationId: 'ST-006',
        slotId: 'SL-06-01',
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
        stationId: 'ST-007',
        slotId: 'SL-07-02',
        rentedAt: '2026-07-23 18:02',
        dueAt: '2026-07-24 18:02',
        status: 'COMPLETED',
        returnAttemptId: 'RT-88208',
        settlementId: 'S-1043',
    },
];

const RAW_RETURNS: Omit<ReturnAttempt, 'slotLabel'>[] = [
    /* 결제까지 끝난 과거 정산(S-1024 · S-1018)이 가리키는 반납들. */
    {
        returnAttemptId: 'RT-87905',
        rentalId: 'R-87900',
        userRef: 'u_3a90',
        stationName: '중앙도서관',
        stationId: 'ST-002',
        slotId: 'SL-02-03',
        attemptedAt: '2026-07-23 11:02',
        status: 'COMPLETED',
        aiResult: 'NORMAL',
        aiScore: 0.08,
        modelVersion: 'v0.4',
        latencyMs: 281,
        reviewStatus: null,
        inspectionId: null,
        settlementId: 'S-1024',
    },
    {
        returnAttemptId: 'RT-87866',
        rentalId: 'R-87860',
        userRef: 'u_77a0',
        stationName: '자연과학관',
        stationId: 'ST-006',
        slotId: 'SL-06-04',
        attemptedAt: '2026-07-22 18:33',
        status: 'COMPLETED',
        aiResult: 'DAMAGED',
        aiScore: 0.94,
        modelVersion: 'v0.4',
        latencyMs: 305,
        reviewStatus: 'DECIDED',
        inspectionId: 'IN-0604',
        settlementId: 'S-1018',
    },
    /* 타임라인이 가리키는 반납 두 건. 위 대여 두 건과 짝입니다. */
    {
        returnAttemptId: 'RT-87720',
        rentalId: 'R-87699',
        userRef: 'u_8f3a',
        stationName: '정문 광장',
        stationId: 'ST-001',
        slotId: 'SL-01-05',
        attemptedAt: '2026-07-20 10:30',
        status: 'COMPLETED',
        aiResult: 'NORMAL',
        aiScore: 0.06,
        modelVersion: 'v0.4',
        latencyMs: 288,
        reviewStatus: null,
        inspectionId: null,
        settlementId: null,
    },
    {
        returnAttemptId: 'RT-87510',
        rentalId: 'R-87488',
        userRef: 'u_8f3a',
        stationName: '경영관',
        stationId: 'ST-005',
        slotId: 'SL-05-02',
        attemptedAt: '2026-07-18 19:40',
        status: 'COMPLETED',
        aiResult: 'NORMAL',
        aiScore: 0.04,
        modelVersion: 'v0.4',
        latencyMs: 301,
        reviewStatus: null,
        inspectionId: null,
        settlementId: null,
    },
    {
        returnAttemptId: 'RT-88213',
        rentalId: 'R-88021',
        userRef: 'u_8f3a',
        stationName: '제1공학관',
        stationId: 'ST-003',
        slotId: 'SL-03-07',
        attemptedAt: '2026-07-24 09:12',
        status: 'COMPLETED',
        aiResult: 'DAMAGED',
        aiScore: 0.92,
        modelVersion: 'v0.4',
        latencyMs: 320,
        reviewStatus: 'PENDING',
        inspectionId: 'IN-0307',
        settlementId: null,
    },
    {
        returnAttemptId: 'RT-88205',
        rentalId: 'R-88099',
        userRef: 'u_3a90',
        stationName: '중앙도서관',
        stationId: 'ST-002',
        slotId: 'SL-02-11',
        attemptedAt: '2026-07-24 08:58',
        status: 'COMPLETED',
        aiResult: 'DAMAGED',
        aiScore: 0.88,
        modelVersion: 'v0.4',
        latencyMs: 296,
        reviewStatus: 'PENDING',
        inspectionId: 'IN-0211',
        settlementId: null,
    },
    {
        returnAttemptId: 'RT-88208',
        rentalId: 'R-88015',
        userRef: 'u_1f55',
        stationName: '제1공학관',
        stationId: 'ST-003',
        slotId: 'SL-03-06',
        attemptedAt: '2026-07-24 08:47',
        status: 'COMPLETED',
        aiResult: 'DAMAGED',
        aiScore: 0.92,
        modelVersion: 'v0.4',
        latencyMs: 311,
        reviewStatus: 'DECIDED',
        inspectionId: 'IN-0306',
        settlementId: 'S-1043',
    },
    {
        returnAttemptId: 'RT-87980',
        rentalId: 'R-87940',
        userRef: 'u_9c02',
        stationName: '경영관',
        stationId: 'ST-005',
        slotId: 'SL-05-07',
        attemptedAt: '2026-07-24 08:20',
        status: 'COMPLETED',
        aiResult: 'UNCERTAIN',
        aiScore: 0.54,
        modelVersion: 'v0.4',
        latencyMs: 402,
        reviewStatus: 'PENDING',
        inspectionId: 'IN-0507',
        settlementId: null,
    },
    {
        returnAttemptId: 'RT-88190',
        rentalId: 'R-88001',
        userRef: 'u_2b71',
        stationName: '정문 광장',
        stationId: 'ST-001',
        slotId: 'SL-01-08',
        attemptedAt: '2026-07-24 08:03',
        status: 'COMPLETED',
        aiResult: 'NORMAL',
        aiScore: 0.97,
        modelVersion: 'v0.4',
        latencyMs: 274,
        reviewStatus: null,
        inspectionId: null,
        settlementId: null,
    },
    {
        returnAttemptId: 'RT-88180',
        rentalId: 'R-87988',
        userRef: 'u_4d10',
        stationName: '제1공학관',
        stationId: 'ST-003',
        slotId: 'SL-03-19',
        attemptedAt: '2026-07-24 07:46',
        status: 'COMPLETED',
        aiResult: 'DAMAGED',
        aiScore: 0.81,
        modelVersion: 'v0.4',
        latencyMs: 338,
        reviewStatus: 'PENDING',
        inspectionId: 'IN-0319',
        settlementId: null,
    },
    {
        returnAttemptId: 'RT-88055',
        rentalId: 'R-88010',
        userRef: 'u_0b3c',
        stationName: '생활관 A',
        stationId: 'ST-007',
        slotId: 'SL-07-02',
        attemptedAt: '2026-07-23 21:03',
        status: 'COMPLETED',
        aiResult: 'NORMAL',
        aiScore: 0.95,
        modelVersion: 'v0.4',
        latencyMs: 281,
        reviewStatus: 'DECIDED',
        inspectionId: 'IN-0702',
        settlementId: null,
    },
];

const RAW_SETTLEMENTS: Omit<Settlement, 'slotLabel'>[] = [
    {
        settlementId: 'S-1043',
        userRef: 'u_8f3a',
        reason: 'DAMAGE',
        amount: 7000,
        paidAmount: 0,
        status: 'PENDING',
        createdAt: '2026-07-24 09:20',
        paidAt: null,
        rentalId: 'R-87995',
        returnAttemptId: 'RT-88208',
        slotId: 'SL-03-06',
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
        slotId: null,
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
        slotId: 'SL-01-02',
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
        slotId: null,
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
        slotId: 'SL-06-04',
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
        slotId: null,
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
export const MOCK_RENTALS: Rental[] = RAW_RENTALS.map((item) => ({
    ...item,
    userRef: userUuid(item.userRef),
    rentalId: rentalUuid(item.rentalId),
    stationId: stationUuid(item.stationId),
    slotLabel: slotLabelOf(item.slotId),
    slotId: slotUuidOf(item.slotId),
    returnAttemptId: item.returnAttemptId && returnUuid(item.returnAttemptId),
    settlementId: item.settlementId && settlementUuid(item.settlementId),
}));

export const MOCK_RETURNS: ReturnAttempt[] = RAW_RETURNS.map((item) => ({
    ...item,
    userRef: userUuid(item.userRef),
    returnAttemptId: returnUuid(item.returnAttemptId),
    rentalId: rentalUuid(item.rentalId),
    stationId: stationUuid(item.stationId),
    slotLabel: item.slotId && slotLabelOf(item.slotId),
    slotId: item.slotId && slotUuidOf(item.slotId),
    settlementId: item.settlementId && settlementUuid(item.settlementId),
}));

export const MOCK_SETTLEMENTS: Settlement[] = RAW_SETTLEMENTS.map((item) => ({
    ...item,
    userRef: userUuid(item.userRef),
    settlementId: settlementUuid(item.settlementId),
    rentalId: rentalUuid(item.rentalId),
    returnAttemptId: item.returnAttemptId && returnUuid(item.returnAttemptId),
    slotLabel: item.slotId && slotLabelOf(item.slotId),
    slotId: item.slotId && slotUuidOf(item.slotId),
}));

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
