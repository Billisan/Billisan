import { describe, expect, it } from 'vitest';

import { dayOf, formatDateTime, formatDayTime, formatTimeOnly, todayInKst } from '@/shared/lib/datetime';

/**
 * 서버 시각 문자열 다루기.
 *
 * 여기서 검증하는 성질은 하나입니다 — **`Date` 파싱을 거치지 않아 시간대 해석이
 * 끼어들지 않는다.** 서버가 KST(`+09:00`)로 주는데 중간에 UTC 해석이 한 번이라도
 * 들어가면 아홉 시간이 밀립니다.
 */

describe('표시 형식 — 자르기만 한다', () => {
    /** 서버가 실제로 주는 모양(`LocalDateTime` 직렬화)과 목업 모양 둘 다. */
    const SERVER = '2026-08-01T08:52:31.123456';
    const SEED = '2026-08-01T08:52:00.000000+09:00';
    const DISPLAY = '2026-08-01 08:52';

    it('세 형식 모두에서 같은 값을 뽑는다', () => {
        /*
         * 11번째 글자가 `T` 든 공백이든 자리는 같습니다. 이 성질이 깨지면 화면에
         * `08-01T08:52:00.000000` 같은 원문이 그대로 찍힙니다(실제로 있었던 회귀).
         */
        for (const value of [SERVER, SEED, DISPLAY]) {
            expect(formatDateTime(value), value).toBe('2026-08-01 08:52');
            expect(formatDayTime(value), value).toBe('08-01 08:52');
            expect(formatTimeOnly(value), value).toBe('08:52');
            expect(dayOf(value), value).toBe('2026-08-01');
        }
    });

    it('마이크로초가 있어도 분까지만 남는다', () => {
        expect(formatDateTime(SERVER)).not.toContain('123456');
    });
});

describe('todayInKst — 기준일이 KST 여야 한다', () => {
    /*
     * `BILL-154` 가 MySQL 세션 시간대를 `+09:00` 으로 고정해서, 서버 시각은
     * KST 입니다. 기간 필터의 기준일도 같은 축이어야 경계일이 안 밀립니다.
     */

    it('UTC 로 아직 전날인 시각에도 KST 오늘을 준다', () => {
        /*
         * **이 테스트가 잡는 버그입니다.** 08-06 08:00 KST 는 UTC 로 08-05 23:00 이라,
         * `new Date().toISOString()` 은 `2026-08-05` 를 줍니다. 그러면 「최근 7일」이
         * 7일이 아니라 8일치를 잡습니다.
         *
         * 00:00~09:00 KST 에만 나타나서 낮에 손으로 눌러 보면 절대 안 걸립니다.
         */
        const at0800Kst = Date.parse('2026-08-05T23:00:00.000Z');
        expect(new Date(at0800Kst).toISOString().slice(0, 10)).toBe('2026-08-05'); // 옛 동작
        expect(todayInKst(at0800Kst)).toBe('2026-08-06'); // 고친 동작
    });

    it('KST 자정 직후와 직전에서 날짜가 정확히 갈린다', () => {
        // 08-06 00:00:00 KST = 08-05 15:00 UTC
        expect(todayInKst(Date.parse('2026-08-05T15:00:00.000Z'))).toBe('2026-08-06');
        // 그 1ms 전은 아직 08-05
        expect(todayInKst(Date.parse('2026-08-05T14:59:59.999Z'))).toBe('2026-08-05');
    });

    it('PC 시간대 설정에 딸려가지 않는다', () => {
        /*
         * 로컬 시각 API(`getFullYear` 등)를 쓰면 PC 가 UTC 로 맞춰진 순간 결과가
         * 바뀝니다. 같은 순간을 넣으면 언제나 같은 답이어야 합니다.
         */
        const instant = Date.parse('2026-08-05T23:30:00.000Z');
        expect(todayInKst(instant)).toBe(todayInKst(instant));
        expect(todayInKst(instant)).toBe('2026-08-06');
    });
});
