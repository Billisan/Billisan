import { describe, expect, it } from 'vitest';

import { hasFinalConsonant, josa } from '@/shared/lib/josa';

/**
 * 한글 조사.
 *
 * 대여소 이름은 서버 데이터라 조사를 고정할 수 없습니다. 「정문 광장는 적정 이상입니다」
 * 처럼 어색한 문장이 실제로 화면에 나갔습니다. 목업 대여소 이름을 전부 넣어 둡니다 —
 * 새 이름이 추가돼도 여기서 걸립니다.
 */
describe('hasFinalConsonant', () => {
    it.each([
        ['정문 광장', true], // 장 = ㅈ+ㅏ+ㅇ
        ['중앙도서관', true], // 관
        ['제1공학관', true],
        ['경영관', true],
        ['대운동장', true],
    ])('%s 는 받침이 있다', (word, expected) => {
        expect(hasFinalConsonant(word)).toBe(expected);
    });

    it.each([
        ['자연과학관 앞 정류소', false], // 소 = ㅅ+ㅗ
        ['후문', true],
        ['도서관 로비', false], // 비
    ])('%s → %s', (word, expected) => {
        expect(hasFinalConsonant(word)).toBe(expected);
    });

    /** 영문·숫자로 끝나면 받침을 판정할 수 없습니다. 받침 없음으로 일관되게 둡니다. */
    it.each([['생활관 A'], ['Station 1'], ['B동'], ['']])(
        '%s 처럼 한글로 안 끝나면 받침 없음으로 본다',
        (word) => {
            expect(hasFinalConsonant(word)).toBe(word === 'B동');
        },
    );

    it('앞뒤 공백은 무시한다', () => {
        expect(hasFinalConsonant('정문 광장  ')).toBe(true);
    });
});

describe('josa', () => {
    it.each([
        ['정문 광장', '은는', '정문 광장은'],
        ['중앙도서관', '은는', '중앙도서관은'],
        ['빌리대역 출구', '은는', '빌리대역 출구는'],
        ['생활관 A', '은는', '생활관 A는'],
    ] as const)('%s + %s → %s', (word, pair, expected) => {
        expect(josa(word, pair)).toBe(expected);
    });

    it.each([
        ['경영관', '이가', '경영관이'],
        ['정류소', '이가', '정류소가'],
        ['대운동장', '을를', '대운동장을'],
        ['도서관 로비', '을를', '도서관 로비를'],
        ['제1공학관', '으로로', '제1공학관으로'],
        ['정류소', '으로로', '정류소로'],
    ] as const)('%s + %s → %s', (word, pair, expected) => {
        expect(josa(word, pair)).toBe(expected);
    });
});
