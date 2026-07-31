import { describe, expect, it } from 'vitest';

import { safeReturnPath } from '@/features/auth/lib/returnPath';

/**
 * 로그인 후 복귀 경로 (화면흐름 §15).
 *
 * `from` 은 `ProtectedRoute` 가 담아 주지만 주소창을 거쳐 들어올 수 있는 값이라,
 * 그대로 믿고 이동하면 로그인 직후에 바깥 사이트로 보낼 수 있습니다(open redirect).
 * 그래서 "같은 출처 안의 경로"만 통과시키고, 나머지는 전부 `/` 로 떨어뜨립니다.
 */
describe('safeReturnPath', () => {
    it.each([
        ['평범한 경로', { pathname: '/inspections' }, '/inspections'],
        [
            '조회 조건까지',
            { pathname: '/history/rentals', search: '?period=1M' },
            '/history/rentals?period=1M',
        ],
        ['해시까지', { pathname: '/stations', hash: '#top' }, '/stations#top'],
    ])('%s 는 그대로 돌려준다', (_label, from, expected) => {
        expect(safeReturnPath(from)).toBe(expected);
    });

    /** 여기 있는 값들이 통과하면 로그인 직후 바깥 사이트로 끌려갑니다. */
    it.each([
        ['프로토콜 상대 URL', { pathname: '//evil.example/pwn' }],
        ['역슬래시 변종', { pathname: '/\\evil.example' }],
        ['절대 URL', { pathname: 'https://evil.example' }],
        ['스킴 없는 절대 경로 아님', { pathname: 'evil.example' }],
        ['자바스크립트 스킴', { pathname: 'javascript:alert(1)' }],
    ])('%s 은 / 로 떨군다', (_label, from) => {
        expect(safeReturnPath(from)).toBe('/');
    });

    it('로그인 화면으로는 되돌아가지 않는다', () => {
        // 통과시키면 로그인 → 로그인 화면 → 로그인 … 으로 갇힙니다.
        expect(safeReturnPath({ pathname: '/login' })).toBe('/');
    });

    it.each([
        ['없음', undefined],
        ['null', null],
        ['문자열', '/inspections'],
        ['pathname 없음', { search: '?x=1' }],
        ['pathname 이 문자열이 아님', { pathname: 123 }],
    ])('%s 이면 / 로 간다', (_label, from) => {
        expect(safeReturnPath(from)).toBe('/');
    });
});
