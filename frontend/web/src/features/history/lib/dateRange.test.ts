import { describe, expect, it } from 'vitest';

import {
    DEFAULT_PERIOD,
    PERIOD_OPTIONS,
    parsePeriod,
    resolveRange,
    withinRange,
} from '@/features/history/lib/dateRange';

/**
 * 조회 기간.
 *
 * **예전 드롭다운은 아무 일도 하지 않았습니다.** 값이 URL 에는 쓰였지만 목록 필터가
 * 그걸 읽지 않아서 무엇을 골라도 결과가 같았습니다. 이 테스트가 그 상태로 되돌아가는 걸
 * 막습니다 — 범위 계산이 틀리면 화면도 틀립니다.
 */

const ASOF = '2026-07-24 09:20';

describe('parsePeriod', () => {
    it('아는 값만 받고 나머지는 기본값으로', () => {
        expect(parsePeriod('7D')).toBe('7D');
        expect(parsePeriod('3M')).toBe('3M');
        expect(parsePeriod('CUSTOM')).toBe('CUSTOM');
        expect(parsePeriod('30D')).toBe(DEFAULT_PERIOD); // 예전 값
        expect(parsePeriod(null)).toBe(DEFAULT_PERIOD);
        expect(parsePeriod('아무거나')).toBe(DEFAULT_PERIOD);
    });

    it('선택지가 넷이다', () => {
        expect(PERIOD_OPTIONS.map((o) => o.value)).toEqual(['7D', '1M', '3M', 'CUSTOM']);
    });

    it('라벨에 날짜를 박아 두지 않는다', () => {
        // 예전 첫 항목이 '기간: 07.01 ~ 07.24' 라서 기준일이 바뀌면 거짓말이 됐습니다.
        for (const option of PERIOD_OPTIONS) {
            expect(option.label, option.value).not.toMatch(/\d{2}\.\d{2}|\d{4}-\d{2}/);
        }
    });
});

describe('resolveRange', () => {
    it('최근 일주일은 오늘을 포함해 7일이다', () => {
        expect(resolveRange('7D', ASOF)).toEqual({ from: '2026-07-18', to: '2026-07-24' });
    });

    it('최근 한 달은 30일', () => {
        expect(resolveRange('1M', ASOF)).toEqual({ from: '2026-06-25', to: '2026-07-24' });
    });

    it('최근 세 달은 90일', () => {
        expect(resolveRange('3M', ASOF)).toEqual({ from: '2026-04-26', to: '2026-07-24' });
    });

    it('달을 건너뛰어도 날짜가 맞는다', () => {
        // 문자열로만 다뤄 타임존이 끼어들지 않는지 봅니다.
        expect(resolveRange('7D', '2026-03-03').from).toBe('2026-02-25');
        expect(resolveRange('7D', '2026-01-03').from).toBe('2025-12-28');
    });

    it('사용자 지정은 준 날짜를 그대로 쓴다', () => {
        expect(resolveRange('CUSTOM', ASOF, { from: '2026-07-01', to: '2026-07-10' })).toEqual({
            from: '2026-07-01',
            to: '2026-07-10',
        });
    });

    it('시작일과 종료일을 거꾸로 넣어도 정렬한다', () => {
        expect(resolveRange('CUSTOM', ASOF, { from: '2026-07-10', to: '2026-07-01' })).toEqual({
            from: '2026-07-01',
            to: '2026-07-10',
        });
    });

    it('사용자 지정인데 날짜가 비면 기본 기간으로 되돌린다', () => {
        /*
         * 빈 범위로 목록을 0건으로 만들면 관리자는 데이터가 없어졌다고 읽습니다.
         * 날짜를 고르는 중(한쪽만 채운 상태)에도 화면이 비지 않아야 합니다.
         */
        expect(resolveRange('CUSTOM', ASOF)).toEqual(resolveRange(DEFAULT_PERIOD, ASOF));
        expect(resolveRange('CUSTOM', ASOF, { from: '2026-07-01' })).toEqual(
            resolveRange(DEFAULT_PERIOD, ASOF),
        );
    });
});

describe('withinRange', () => {
    const range = { from: '2026-07-18', to: '2026-07-24' };

    it('양 끝을 포함한다', () => {
        expect(withinRange('2026-07-18 00:00', range)).toBe(true);
        expect(withinRange('2026-07-24 23:59', range)).toBe(true);
    });

    it('범위 밖은 걸러낸다', () => {
        expect(withinRange('2026-07-17 23:59', range)).toBe(false);
        expect(withinRange('2026-07-25 00:00', range)).toBe(false);
    });

    it('시각이 붙어 있어도 날짜만 본다', () => {
        expect(withinRange('2026-07-20 09:20', range)).toBe(true);
        expect(withinRange('2026-07-20', range)).toBe(true);
    });
});
