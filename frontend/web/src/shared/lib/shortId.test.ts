import { describe, expect, it } from 'vitest';

import { shortId } from '@/shared/lib/shortId';

/**
 * UUID 축약.
 *
 * **`null` 을 받아 내는 게 핵심입니다.** 서버가 못 채운 식별자가 실제로 옵니다 —
 * 검수 목록의 `stationId`·`slotId` 는 검수 → 반납 시도 → 슬롯 순으로 따라가 채우는
 * 값이라, 중간이 끊기면 `null` 입니다(`InspectionAdminService`).
 *
 * 타입이 `string` 이던 시절 실서버에서 그 값이 와서 `null.slice()` 로 터졌고,
 * `Array.map` 안이라 **검수 목록 화면 전체가 흰 화면**이 됐습니다.
 * ("Unexpected Application Error! Cannot read properties of null (reading 'slice')")
 */

describe('shortId', () => {
    it('UUID 앞 8자만 남긴다', () => {
        expect(shortId('a785b1dd-1111-4111-8111-aaaaaaaaaaaa')).toBe('a785b1dd…');
    });

    it('null·undefined 로 터지지 않는다', () => {
        /*
         * 화면 한 칸을 못 채우는 것과 화면 전체가 죽는 것은 전혀 다릅니다.
         * 식별자 하나 못 읽었다고 목록이 사라지면 안 됩니다.
         */
        expect(() => shortId(null)).not.toThrow();
        expect(() => shortId(undefined)).not.toThrow();
        expect(shortId(null)).toBe('—');
        expect(shortId(undefined)).toBe('—');
    });

    it('빈 문자열도 값 없음으로 본다', () => {
        // `''.slice(0, 8)` 은 빈 문자열이라 「…」만 남습니다. 그건 값처럼 보입니다.
        expect(shortId('')).toBe('—');
    });

    it('8자보다 짧아도 그대로 둔다', () => {
        expect(shortId('abc')).toBe('abc…');
    });
});
