import { describe, expect, it } from 'vitest';

import { readApiError, unwrapEnvelope } from '@/shared/types/api';

/**
 * 응답 봉투와 오류 봉투를 벗기는 규칙.
 *
 * 이 두 함수가 틀리면 **조용히** 고장납니다. 화면은 멀쩡히 넘어가는데 알맹이가 비어서,
 * 눌러 봐도 원인을 알 수 없습니다. 실제로 `{ data: {...} }` 를 못 벗겨 `accessToken` 이
 * `undefined` 인 채 로그인이 "성공"한 적이 있습니다. 그래서 계약이 적어 둔 모양과
 * 백엔드가 줄 법한 모양을 전부 여기에 박아 둡니다.
 */

const PAYLOAD = { accessToken: 'tok', loginId: 'admin01' };

describe('unwrapEnvelope', () => {
    /**
     * 계약(`ADMIN-AUTH-001` 외 9개)이 응답을 「Body · `data`」로 적습니다.
     * 동반 필드를 요구하지 않으므로 `data` 하나만 오는 게 계약 그대로의 모양입니다.
     */
    it('계약 그대로인 { data } 를 벗긴다', () => {
        expect(unwrapEnvelope({ data: PAYLOAD })).toEqual(PAYLOAD);
    });

    it.each([
        ['success 를 곁들인 봉투', { success: true, data: PAYLOAD }],
        ['statusCode 를 곁들인 봉투', { statusCode: 200, data: PAYLOAD }],
        ['메시지까지 붙은 봉투', { success: true, message: 'ok', data: PAYLOAD }],
        [
            '추적 메타가 붙은 봉투',
            { statusCode: 200, requestId: 'r-1', timestamp: 't', data: PAYLOAD },
        ],
    ])('%s 를 벗긴다', (_label, body) => {
        expect(unwrapEnvelope(body)).toEqual(PAYLOAD);
    });

    it('봉투가 없으면 그대로 둔다', () => {
        expect(unwrapEnvelope(PAYLOAD)).toEqual(PAYLOAD);
    });

    /**
     * `data` 옆에 업무 필드가 있으면 봉투가 아닙니다. 벗기면 `stationId` 를 잃습니다.
     * 지금 계약에 그런 DTO 는 없지만, 이 함수는 모든 응답을 지나므로 막아 둡니다.
     */
    it('data 옆에 업무 필드가 있으면 벗기지 않는다', () => {
        const dto = { stationId: 'st-1', data: PAYLOAD };
        expect(unwrapEnvelope(dto)).toEqual(dto);
    });

    it.each([
        ['null', null],
        ['문자열', 'plain'],
        ['배열', [1, 2]],
    ])('%s 은 손대지 않는다', (_label, body) => {
        expect(unwrapEnvelope(body)).toEqual(body);
    });
});

describe('readApiError', () => {
    /**
     * 계약은 오류 코드 이름(`INVALID_ADMIN_CREDENTIALS`·`ADMIN_ACCOUNT_REQUIRED`)만 정하고
     * **본문 모양은 정하지 않았습니다.** 코드를 못 읽으면 화면이 401 과 403 을 구분하지
     * 못해, 관리자 권한이 없는 사람에게 「비밀번호가 틀렸습니다」가 뜹니다.
     */
    it.each([
        [
            '(A) error 가 객체',
            { error: { code: 'ADMIN_ACCOUNT_REQUIRED', message: '관리자 계정이 아닙니다.' } },
        ],
        [
            '(B) error 가 문자열',
            { error: 'ADMIN_ACCOUNT_REQUIRED', message: '관리자 계정이 아닙니다.' },
        ],
        [
            '(C) code 가 최상위',
            { code: 'ADMIN_ACCOUNT_REQUIRED', message: '관리자 계정이 아닙니다.' },
        ],
    ])('%s 에서 코드를 읽는다', (_label, body) => {
        expect(readApiError(body).code).toBe('ADMIN_ACCOUNT_REQUIRED');
    });

    it('error 객체에 문구가 없으면 최상위 message 로 내려간다', () => {
        expect(readApiError({ error: { code: 'X' }, message: '바깥 문구' })).toEqual({
            code: 'X',
            message: '바깥 문구',
        });
    });

    it('error 객체에 코드가 없으면 최상위 code 로 내려간다', () => {
        expect(readApiError({ error: { message: '문구' }, code: 'TOP' }).code).toBe('TOP');
    });

    it('본문이 객체가 아니면 빈 결과를 준다', () => {
        expect(readApiError(null)).toEqual({});
        expect(readApiError('boom')).toEqual({});
    });
});
