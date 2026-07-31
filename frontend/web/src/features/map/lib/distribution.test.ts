import { describe, expect, it } from 'vitest';

import {
    deficit,
    formatStockRatio,
    normalFloor,
    tallyByStatus,
} from '@/features/map/lib/distribution';
import type { Station } from '@/features/stations/types';

/**
 * 분포도 파생 계산.
 *
 * "적정까지 몇 개 모자란가" 같은 숫자는 **틀려도 그럴듯해 보입니다.** 화면만 봐서는
 * 2개가 맞는지 3개가 맞는지 알 수 없어서 여기서 못 박습니다.
 */

function station(overrides: Partial<Station> = {}): Station {
    return {
        stationId: 's-1',
        name: '대여소',
        serviceStatus: 'AVAILABLE',
        deviceStatus: 'ONLINE',
        slotCount: 5,
        available: 3,
        capacity: 5,
        damaged: 0,
        adminReview: 0,
        position: { x: 50, y: 50 },
        ...overrides,
    };
}

describe('normalFloor · deficit', () => {
    /** 슬롯 5개의 1/3 은 1.67 입니다. 1개만 채우면 20% 라 여전히 부족이므로 올림해야 합니다. */
    it.each([
        [3, 1],
        [4, 2],
        [5, 2],
    ])('슬롯 %i개의 적정선은 %i개', (capacity, expected) => {
        expect(normalFloor(capacity)).toBe(expected);
    });

    it('적정 이상이면 부족분이 0이다', () => {
        expect(deficit(station({ capacity: 5, available: 2 }))).toBe(0);
        expect(deficit(station({ capacity: 5, available: 5 }))).toBe(0);
    });

    it('적정선까지 모자란 만큼만 부족분으로 센다', () => {
        expect(deficit(station({ capacity: 5, available: 0 }))).toBe(2);
        expect(deficit(station({ capacity: 5, available: 1 }))).toBe(1);
        expect(deficit(station({ capacity: 3, available: 0 }))).toBe(1);
    });
});

describe('tallyByStatus', () => {
    it('상태별로 센다', () => {
        const tally = tallyByStatus([
            station({ stationId: 'a', capacity: 5, available: 5 }), // 과잉
            station({ stationId: 'b', capacity: 5, available: 3 }), // 적정
            station({ stationId: 'c', capacity: 5, available: 0 }), // 부족
            station({ stationId: 'd', deviceStatus: 'OFFLINE' }), // 오프라인
        ]);
        expect(tally).toEqual({ SURPLUS: 1, NORMAL: 1, SHORTAGE: 1, OFFLINE: 1 });
    });

    it('빈 목록도 0으로 채워 돌려준다', () => {
        // 범례가 `undefined` 를 그리면 "부족 undefined" 가 나옵니다.
        expect(tallyByStatus([])).toEqual({ SURPLUS: 0, NORMAL: 0, SHORTAGE: 0, OFFLINE: 0 });
    });
});

describe('formatStockRatio', () => {
    it.each([
        [5, 5, '100%'],
        [5, 3, '60%'],
        [3, 1, '33%'],
        [5, 0, '0%'],
    ])('슬롯 %i개에 %i개 남으면 %s', (capacity, available, expected) => {
        expect(formatStockRatio(station({ capacity, available }))).toBe(expected);
    });

    it('슬롯이 0개여도 NaN 을 내지 않는다', () => {
        expect(formatStockRatio(station({ capacity: 0, available: 0 }))).toBe('0%');
    });
});
