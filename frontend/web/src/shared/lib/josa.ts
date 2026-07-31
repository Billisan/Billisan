/**
 * 한글 조사 붙이기.
 *
 * 화면 문구에 **데이터로 들어온 이름**을 끼워 넣을 때 필요합니다. 대여소 이름은 서버에서
 * 오므로 조사를 고정해 둘 수 없습니다 — 「정문 광장는」·「경영관가」처럼 어색한 문장이
 * 그대로 나갑니다. 실제로 재배치 추천 문구에서 그렇게 나왔습니다.
 *
 * 판정은 마지막 글자의 받침 유무입니다. 한글 음절은 유니코드에서
 * `0xAC00 + (초성*21 + 중성)*28 + 종성` 으로 배열돼 있어서, `(코드 - 0xAC00) % 28` 이
 * 0 이 아니면 받침이 있습니다.
 *
 * 한글이 아닌 글자로 끝나면(영문·숫자) 받침을 판정할 수 없습니다. 그때는 받침이 없는
 * 쪽을 씁니다 — 어느 쪽도 확실하지 않지만, 무엇을 골라도 완벽하지 않은 자리에서
 * 한쪽으로 일관되게 두는 편이 낫습니다.
 */

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
const JONGSEONG_COUNT = 28;

/** 마지막 글자에 받침이 있는가. 한글이 아니면 `false` 입니다. */
export function hasFinalConsonant(word: string): boolean {
    const last = word.trim().at(-1);
    if (!last) return false;

    const code = last.charCodeAt(0);
    if (code < HANGUL_FIRST || code > HANGUL_LAST) return false;

    return (code - HANGUL_FIRST) % JONGSEONG_COUNT !== 0;
}

/** 받침 유무로 갈리는 조사 쌍 */
const JOSA_PAIRS = {
    은는: ['은', '는'],
    이가: ['이', '가'],
    을를: ['을', '를'],
    과와: ['과', '와'],
    으로로: ['으로', '로'],
} as const;

export type JosaPair = keyof typeof JOSA_PAIRS;

/**
 * 단어에 알맞은 조사를 붙여 돌려줍니다.
 *
 *   josa('정문 광장', '은는')  // '정문 광장은'
 *   josa('중앙도서관', '이가')  // '중앙도서관이'
 *   josa('생활관 A', '은는')   // '생활관 A는'  (한글이 아니라 받침 없음으로 봅니다)
 */
export function josa(word: string, pair: JosaPair): string {
    const [withFinal, withoutFinal] = JOSA_PAIRS[pair];
    return word + (hasFinalConsonant(word) ? withFinal : withoutFinal);
}
