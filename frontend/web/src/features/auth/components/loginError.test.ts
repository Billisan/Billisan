import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 로그인 실패 문구가 **원인을 틀리게 말하지 않는지** 봅니다.
 *
 * 예전에는 `switch` 에 안 걸린 모든 실패가 맨 아래 문구로 떨어졌습니다 —
 * 「아이디 또는 비밀번호가 올바르지 않습니다」. 그래서 **서버가 꺼져 있어도,
 * CORS 에 막혀도, 500 이 나도** 관리자는 자기 비밀번호를 의심했습니다.
 *
 * 실 API 연결 첫날 가장 먼저 마주칠 화면이 로그인이고, 그때 막히는 원인 1순위가
 * CORS·배포 문제입니다. 문구가 틀리면 원인을 찾는 데 몇 시간이 날아갑니다.
 *
 * `LoginForm.tsx` 는 컴포넌트라 렌더 없이 함수만 부를 수 없어서, 여기서는 소스의
 * 분기 구조를 검증합니다. 값 자체는 `adminError.test.ts` 처럼 함수 단위로 볼 수
 * 없지만, **회귀는 이 구조가 사라질 때 일어납니다.**
 */

const source = readFileSync(
    resolve(process.cwd(), 'src/features/auth/components/LoginForm.tsx'),
    'utf8',
);

/** 주석을 걷어낸 실행 코드. 주석 속 예시 문구에 걸리지 않게 합니다. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('로그인 실패 — 전송 실패를 자격 오류로 말하지 않는다', () => {
    it('응답 없음(statusCode 0)을 따로 가른다', () => {
        /*
         * 인터셉터가 서버 무응답을 `statusCode: 0` 으로 만들고 메시지도 한글로
         * 바꿔 둡니다(`offlineMessageOf`). 그 분기가 있어야 합니다.
         */
        expect(code, 'status === 0 분기가 없습니다').toMatch(/status\s*===\s*0/);
    });

    it('5xx 를 따로 가른다', () => {
        expect(code, '5xx 분기가 없습니다').toMatch(/status\s*>=\s*500/);
    });

    it('429 를 따로 가른다', () => {
        // 속도 제한에 걸린 사람에게 "비밀번호가 틀렸다"고 하면 더 열심히 다시 칩니다.
        expect(code, '429 분기가 없습니다').toMatch(/429/);
    });

    it('자격 오류 문구는 마지막 수단으로만 남는다', () => {
        /*
         * 이 문구가 함수 안에서 **가장 마지막** 에 있어야 합니다. 위로 올라가면
         * 전송 실패가 다시 자격 오류로 둔갑합니다.
         */
        const fn = code.slice(
            code.indexOf('function loginErrorMessage'),
            code.indexOf('const FIELD'),
        );
        expect(fn, 'loginErrorMessage 를 찾지 못했습니다').toContain('아이디 또는 비밀번호');

        const credentialAt = fn.indexOf('아이디 또는 비밀번호');
        for (const branch of ['status === 0', 'status >= 500', '429']) {
            expect(fn.indexOf(branch), `${branch} 가 자격 오류 문구보다 뒤에 있습니다`).toBeLessThan(
                credentialAt,
            );
        }
    });
});

describe('오류 코드가 화면 문구에 새지 않는다', () => {
    it('로그인 문구에 대문자 오류 코드가 없다', () => {
        /*
         * `adminError` 와 같은 규칙입니다 — 관리자에게 `INVALID_REQUEST` 는 정보가
         * 아닙니다. 문자열 리터럴만 검사합니다(`case 'INVALID_REQUEST':` 같은 분기
         * 라벨은 코드지 문구가 아닙니다).
         */
        const messages = [...code.matchAll(/return\s+'([^']*[가-힣][^']*)'/g)].map((m) => m[1]);
        expect(messages.length, '검사할 문구를 못 찾았습니다').toBeGreaterThan(3);
        for (const message of messages) {
            expect(message).not.toMatch(/[A-Z]{2,}_[A-Z_]+/);
        }
    });
});
