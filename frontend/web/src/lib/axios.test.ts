import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';

import { http } from '@/lib/axios';
import { ApiRequestError } from '@/lib/api-error';

/**
 * 응답 인터셉터가 오류를 **관리자가 읽을 수 있는 한글**로 바꾸는지.
 *
 * 예전에는 서버 메시지가 없으면 axios 의 것을 그대로 썼습니다. 서버가 응답을 아예
 * 주지 못하는 상황(꺼짐·망 끊김·타임아웃)에서 화면에 이런 게 떴습니다.
 *   `Network Error`
 *   `timeout of 10000ms exceeded`
 * 관리자는 자기가 뭘 잘못한 줄 알지만 실제로는 서버 쪽 문제라 조치가 정반대입니다.
 */

/** 인터셉터의 실패 핸들러만 꺼내 직접 돌립니다 — 네트워크를 쓰지 않습니다. */
function rejectWith(error: AxiosError): Promise<never> {
    const handlers = (
        http.interceptors.response as unknown as {
            handlers: Array<{ rejected: (e: AxiosError) => Promise<never> }>;
        }
    ).handlers;
    const handler = handlers.find((h) => h?.rejected);
    if (!handler) throw new Error('응답 인터셉터의 실패 핸들러를 찾지 못했습니다');
    return handler.rejected(error);
}

function axiosError(overrides: Partial<AxiosError> = {}): AxiosError {
    const error = new AxiosError('Network Error');
    error.config = { headers: new AxiosHeaders(), url: '/inspections' } as never;
    return Object.assign(error, overrides);
}

async function messageOf(error: AxiosError): Promise<string> {
    try {
        await rejectWith(error);
        throw new Error('거부되지 않았습니다');
    } catch (caught) {
        expect(caught).toBeInstanceOf(ApiRequestError);
        return (caught as ApiRequestError).message;
    }
}

describe('응답 인터셉터 — 오류 메시지', () => {
    it('서버에 닿지 못하면 한글로 안내한다', async () => {
        // 응답 객체가 없는 경우 = 서버가 꺼졌거나 망이 끊긴 것
        const message = await messageOf(axiosError());
        expect(message).toBe('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    });

    it('타임아웃은 연결 실패와 다르게 안내한다', async () => {
        /*
         * 서버가 살아는 있는데 느린 것이라 다시 눌러 볼 만합니다.
         * 「연결하지 못했습니다」로 뭉치면 관리자가 서버가 죽은 줄 압니다.
         */
        const message = await messageOf(axiosError({ code: 'ECONNABORTED' }));
        expect(message).toBe('서버 응답이 너무 늦습니다. 잠시 후 다시 시도해 주세요.');
    });

    it('요청 취소는 오류처럼 말하지 않는다', async () => {
        // 화면을 옮기면 이전 요청이 버려집니다. 관리자 잘못이 아닙니다.
        const message = await messageOf(axiosError({ code: 'ERR_CANCELED' }));
        expect(message).toBe('요청이 취소되었습니다.');
    });

    it('서버가 준 메시지는 손대지 않는다', async () => {
        /*
         * 서버 메시지는 한글이고 더 정확합니다 — 500 은 「일시적인 오류가 발생했습니다.」를
         * 직접 보내 줍니다. 우리 문구로 덮으면 그 정보가 사라집니다.
         */
        const message = await messageOf(
            axiosError({
                response: {
                    status: 500,
                    data: { code: 'INTERNAL_SERVER_ERROR', message: '일시적인 오류가 발생했습니다.' },
                } as never,
            }),
        );
        expect(message).toBe('일시적인 오류가 발생했습니다.');
    });

    it('어떤 경우에도 영문 기술 문구가 새지 않는다', async () => {
        const cases = [
            axiosError(),
            axiosError({ code: 'ECONNABORTED' }),
            axiosError({ code: 'ERR_CANCELED' }),
            axiosError({ response: { status: 502, data: {} } as never }),
        ];
        for (const error of cases) {
            const message = await messageOf(error);
            expect(message, `code=${error.code ?? '-'}`).not.toMatch(/[A-Za-z]{5,}/);
        }
    });
});
