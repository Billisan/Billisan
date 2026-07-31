import { describe, expect, it } from 'vitest';

import { formatServerTime, syncedAtLabel } from '@/shared/lib/syncedAt';

/**
 * 「… 기준」 시각.
 *
 * 이 값이 틀리면 **화면이 거짓말을 합니다.** 방금 받은 데이터를 며칠 전 것이라고 하거나,
 * 시간대 때문에 아홉 시간 어긋나 보입니다. 둘 다 "화면이 낡았나?"를 판단하는 근거를
 * 망가뜨리는데, 숫자가 그럴듯해서 눈으로는 안 걸립니다.
 */

describe('formatServerTime', () => {
    /**
     * `DATETIME(6)` 원문은 파싱하지 않고 자릅니다. 파싱했다 다시 만들면 시간대 해석이
     * 끼어들어 하루가 밀립니다 — `formatUpdatedAt` 이 같은 이유로 자르기만 합니다.
     */
    it.each([
        ['2026-07-24 09:20:11.123456', '2026-07-24 09:20'],
        ['2026-07-24 09:20:11', '2026-07-24 09:20'],
        ['2026-07-24T09:20:11', '2026-07-24 09:20'],
    ])('%s → %s (자르기만 함)', (input, expected) => {
        expect(formatServerTime(input)).toBe(expected);
    });

    /** `Z` 로 끝나는 UTC 표기는 잘라 쓰면 아홉 시간 어긋나므로 이때만 파싱합니다. */
    it('UTC 표기는 로컬 시간으로 옮긴다', () => {
        const utc = '2026-07-24T00:20:00.000Z';
        const expected = new Date(utc);
        const pad = (n: number) => String(n).padStart(2, '0');
        expect(formatServerTime(utc)).toBe(
            `${expected.getFullYear()}-${pad(expected.getMonth() + 1)}-${pad(expected.getDate())} ${pad(expected.getHours())}:${pad(expected.getMinutes())}`,
        );
    });

    it('오프셋 표기도 로컬로 옮긴다', () => {
        expect(formatServerTime('2026-07-24T09:20:00+09:00')).toMatch(
            /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
        );
    });
});

describe('syncedAtLabel', () => {
    /** 서버가 준 시각이 있으면 그게 권위입니다 — 언제 센 값인지가 언제 받았는지보다 정확합니다. */
    it('서버 시각이 있으면 그걸 쓴다', () => {
        expect(syncedAtLabel('2026-07-24 09:20:11.123456', Date.now())).toBe(
            '2026-07-24 09:20 기준',
        );
    });

    it('서버 시각이 없으면 받은 시각을 쓴다', () => {
        const at = new Date(2026, 6, 31, 14, 5).getTime();
        expect(syncedAtLabel(undefined, at)).toBe('2026-07-31 14:05 기준');
    });

    /** 아직 아무것도 못 받았으면 시각을 지어내지 않습니다. PageBar 는 빈 meta 를 안 그립니다. */
    it('둘 다 없으면 빈 문자열', () => {
        expect(syncedAtLabel(undefined, undefined)).toBe('');
        expect(syncedAtLabel(undefined, 0)).toBe('');
    });
});
