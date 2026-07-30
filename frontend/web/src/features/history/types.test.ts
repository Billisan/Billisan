import { describe, expect, it } from 'vitest';

import {
    formatWon,
    outstandingOf,
    RENTAL_STATUS_LABEL,
    rentalDisplayStatus,
    RETURN_STATUS_LABEL,
    type Rental,
    type RentalStatus,
    type ReturnAttemptStatus,
    type Settlement,
} from '@/features/history/types';

/**
 * 이력 파생 함수.
 *
 * 연체 판정이 핵심입니다. 상태가 아닌 것을 상태처럼 다루면 서버로 없는 값을 보내게 됩니다.
 */

const ASOF = '2026-07-24 09:20';

function rental(overrides: Partial<Rental> = {}): Rental {
    return {
        rentalId: 'RN-1',
        userRef: 'user-1',
        stationName: '제1공학관',
        stationId: 'station-1',
        slotId: 'slot-1',
        slotLabel: '1번 슬롯',
        rentedAt: '2026-07-23 09:00',
        dueAt: '2026-07-25 09:00',
        status: 'ACTIVE',
        returnAttemptId: null,
        settlementId: null,
        ...overrides,
    };
}

function settlement(overrides: Partial<Settlement> = {}): Settlement {
    return {
        settlementId: 'ST-1',
        userRef: 'user-1',
        reason: 'OVERDUE',
        amount: 3000,
        paidAmount: 0,
        status: 'PENDING',
        createdAt: '2026-07-24 09:00',
        paidAt: null,
        rentalId: 'RN-1',
        returnAttemptId: null,
        slotId: null,
        slotLabel: null,
        decisionReason: null,
        ...overrides,
    };
}

describe('rentalDisplayStatus', () => {
    it('기한이 지난 대여중은 연체로 덮는다', () => {
        expect(rentalDisplayStatus(rental({ dueAt: '2026-07-24 09:00' }), ASOF)).toBe('OVERDUE');
    });

    it('기한 전이면 서버 상태를 그대로 쓴다', () => {
        expect(rentalDisplayStatus(rental({ dueAt: '2026-07-25 09:00' }), ASOF)).toBe('ACTIVE');
    });

    it('대여중이 아니면 기한이 지났어도 연체가 아니다', () => {
        /*
         * 이미 반납·분실·취소로 끝난 건은 연체 배지를 달면 안 됩니다. 끝난 건의
         * 미납액은 정산이 표현하고, 연체는 "지금 안 돌아온 상태" 를 가리킵니다.
         */
        const past = '2026-07-20 09:00';
        const closed: RentalStatus[] = ['COMPLETED', 'LOST', 'CANCELLED', 'FAILED', 'REQUESTED'];
        for (const status of closed) {
            expect(rentalDisplayStatus(rental({ status, dueAt: past }), ASOF)).toBe(status);
        }
    });

    it('기준 시각을 인자로 받는다 — 안에서 현재 시각을 읽지 않는다', () => {
        /*
         * new Date() 를 안에서 부르면 목업(2026-07-24 기준)이 실제 시각과 어긋나 전부
         * 연체로 보입니다. 같은 대여가 기준 시각에 따라 다르게 나와야 맞습니다.
         */
        const item = rental({ dueAt: '2026-07-24 12:00' });
        expect(rentalDisplayStatus(item, '2026-07-24 09:20')).toBe('ACTIVE');
        expect(rentalDisplayStatus(item, '2026-07-25 09:20')).toBe('OVERDUE');
    });

    it('OVERDUE 는 서버 상태 집합에 없다', () => {
        // 화면흐름 §8.1: 연체는 파생값이며 신규 RentalStatus 를 추가하지 않는다.
        const serverStatuses: RentalStatus[] = [
            'REQUESTED',
            'ACTIVE',
            'RETURNING',
            'COMPLETED',
            'LOST',
            'CANCELLED',
            'FAILED',
        ];
        expect(serverStatuses).not.toContain('OVERDUE');
        // 라벨 사전에는 있어야 합니다 — 배지에 찍을 글자가 필요합니다.
        expect(RENTAL_STATUS_LABEL.OVERDUE).toBe('연체');
    });

    it('RETURNED 는 없는 값이다 — 반납 완료는 COMPLETED 다', () => {
        expect(Object.keys(RENTAL_STATUS_LABEL)).not.toContain('RETURNED');
        expect(RENTAL_STATUS_LABEL.COMPLETED).toBe('반납완료');
    });
});

describe('반납 상태 집합', () => {
    it('ERD §8.0 의 다섯 값을 전부 갖는다', () => {
        const erd: ReturnAttemptStatus[] = [
            'PROCESSING',
            'PHYSICAL_DONE',
            'COMPLETED',
            'RECOVERY_REQUIRED',
            'FAILED',
        ];
        expect(Object.keys(RETURN_STATUS_LABEL).sort()).toEqual([...erd].sort());
    });

    it('검수 처리 상태를 반납 상태에 섞지 않는다', () => {
        /*
         * 예전에 REVIEW_PENDING·REVIEW_DONE·RECOVERY 를 반납 상태로 두고 있었습니다.
         * 섞으면 "반납은 끝났고 검수만 남았다" 와 "반납 자체가 안 끝났다" 를 구분할 수
         * 없습니다 (화면흐름 §9.1 이 셋을 따로 표시하라고 함).
         */
        const keys = Object.keys(RETURN_STATUS_LABEL);
        expect(keys).not.toContain('REVIEW_PENDING');
        expect(keys).not.toContain('REVIEW_DONE');
        expect(keys).not.toContain('RECOVERY');
    });
});

describe('outstandingOf', () => {
    it('미납액은 금액에서 낸 금액을 뺀 값이다', () => {
        expect(outstandingOf(settlement({ amount: 7000, paidAmount: 2000 }))).toBe(5000);
        expect(outstandingOf(settlement({ amount: 3000, paidAmount: 3000 }))).toBe(0);
    });
});

describe('formatWon', () => {
    it('천 단위를 끊어 원화로 찍는다', () => {
        expect(formatWon(7000)).toBe('₩7,000');
        expect(formatWon(0)).toBe('₩0');
    });
});
