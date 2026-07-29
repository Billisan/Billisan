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
 * 사용자는 내부 userId 축약(`u_xxxx`)만 담습니다. 이름·연락처·대학 계정 식별자·`password_hash`
 * 는 어떤 형태로도 넣지 않습니다 (화면흐름 §6.3 · §12).
 */

export const HISTORY_SYNCED_AT = '2026-07-24 09:20';

/** 시안 하단 안내 문구. 우산 ID 없이 대여 ID 로 추적한다는 원칙을 화면에 남깁니다. */
export const RENTAL_LIST_NOTE =
    '대여 상태: 대여중 · 연체(기한 초과 미반납) · 반납완료 · 분실(장기 미반납) · 개별 우산 ID 없이 대여 ID(R-)로 추적합니다';

export const MOCK_RENTALS: Rental[] = [
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
        status: 'RETURNED',
        returnAttemptId: 'RT-88213',
        settlementId: 'S-1043',
    },
    {
        rentalId: 'R-87940',
        userRef: 'u_9c02',
        stationName: '경영관',
        stationId: 'ST-005',
        slotId: 'SL-05-03',
        rentedAt: '2026-07-22 11:20',
        dueAt: '2026-07-23 11:20',
        status: 'OVERDUE',
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
        status: 'RETURNED',
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
        status: 'RETURNED',
        returnAttemptId: 'RT-88055',
        settlementId: null,
    },
];

export const MOCK_RETURNS: ReturnAttempt[] = [
    {
        returnAttemptId: 'RT-88213',
        rentalId: 'R-88021',
        userRef: 'u_8f3a',
        stationName: '제1공학관',
        stationId: 'ST-003',
        slotId: 'SL-03-07',
        attemptedAt: '2026-07-24 09:12',
        status: 'REVIEW_PENDING',
        aiResult: 'DAMAGED',
        aiScore: 0.92,
        modelVersion: 'v0.4',
        latencyMs: 320,
        inspectionId: 'IN-0307',
        settlementId: 'S-1043',
    },
    {
        returnAttemptId: 'RT-88205',
        rentalId: 'R-88099',
        userRef: 'u_3a90',
        stationName: '중앙도서관',
        stationId: 'ST-002',
        slotId: 'SL-02-11',
        attemptedAt: '2026-07-24 08:58',
        status: 'REVIEW_PENDING',
        aiResult: 'DAMAGED',
        aiScore: 0.88,
        modelVersion: 'v0.4',
        latencyMs: 296,
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
        status: 'REVIEW_DONE',
        aiResult: 'DAMAGED',
        aiScore: 0.92,
        modelVersion: 'v0.4',
        latencyMs: 311,
        inspectionId: 'IN-0306',
        settlementId: 'S-1041',
    },
    {
        returnAttemptId: 'RT-87980',
        rentalId: 'R-87940',
        userRef: 'u_9c02',
        stationName: '경영관',
        stationId: 'ST-005',
        slotId: 'SL-05-07',
        attemptedAt: '2026-07-24 08:20',
        status: 'REVIEW_PENDING',
        aiResult: 'UNCERTAIN',
        aiScore: 0.54,
        modelVersion: 'v0.4',
        latencyMs: 402,
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
        status: 'REVIEW_PENDING',
        aiResult: 'DAMAGED',
        aiScore: 0.81,
        modelVersion: 'v0.4',
        latencyMs: 338,
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
        status: 'REVIEW_DONE',
        aiResult: 'NORMAL',
        aiScore: 0.95,
        modelVersion: 'v0.4',
        latencyMs: 281,
        inspectionId: 'IN-0702',
        settlementId: null,
    },
];

export const MOCK_SETTLEMENTS: Settlement[] = [
    {
        settlementId: 'S-1043',
        userRef: 'u_8f3a',
        reason: 'DAMAGE',
        amount: 7000,
        paidAmount: 0,
        status: 'PENDING',
        createdAt: '2026-07-24 09:20',
        paidAt: null,
        rentalId: 'R-88021',
        returnAttemptId: 'RT-88213',
        slotId: 'SL-03-07',
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

export const MOCK_USER: UserSummary = {
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
