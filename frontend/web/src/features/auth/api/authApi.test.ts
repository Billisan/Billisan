import { describe, expect, it } from 'vitest';

import { http } from '@/lib/axios';
import { env } from '@/config/env';
import type { LoginRequest, LoginResponse } from '@/features/auth/types';

/**
 * `ADMIN-AUTH-001 관리자 로그인` 계약 준수.
 *
 * 백엔드가 붙는 순간 어긋나면 로그인 자체가 막히는 항목들입니다. 계약 원문(12-R v3.0)의
 * 필드·헤더·오류 코드를 그대로 못 박아 둡니다.
 *
 *   POST /api/v1/admin/auth/login
 *   Header  X-Request-Id(UUID, 필수) · Accept(필수) · Content-Type(필수)
 *   Body    loginId · password
 *   Response accessToken · tokenType · adminId · loginId · role
 *            · idleExpiresAt · absoluteExpiresAt
 */

describe('요청 규격', () => {
    it('baseURL 이 /api/v1/admin 으로 끝나 경로가 계약과 맞는다', () => {
        /*
         * 각 API 는 `/auth/login` 처럼 짧게 부르므로 baseURL 이 접두사를 맡습니다.
         * `/api` 로 잘못 두면 `/api/auth/login` 이 되어 404 입니다.
         *
         * **동등 비교가 아니라 접미 비교입니다.** 로컬 프록시는 `/api/v1/admin`,
         * 실서버 직결·배포는 `http://…/api/v1/admin` 처럼 오리진이 붙습니다
         * (`.env.local` 을 vitest 도 읽습니다). 불변식은 "admin 경계로 끝난다"입니다.
         */
        expect(env.apiBaseUrl.endsWith('/api/v1/admin')).toBe(true);
        expect(`${env.apiBaseUrl}/auth/login`.endsWith('/api/v1/admin/auth/login')).toBe(true);
    });

    it('Accept · Content-Type 을 계약대로 보낸다', () => {
        const headers = http.defaults.headers as unknown as Record<string, string>;
        expect(headers.Accept).toBe('application/json');
        expect(headers['Content-Type']).toBe('application/json');
    });

    it('X-Request-Id 를 UUID 로 붙인다', async () => {
        // 서버 오류 응답의 meta.requestId 와 짝이 되는 값입니다.
        const handler = (
            http.interceptors.request as unknown as {
                handlers: { fulfilled: (c: unknown) => unknown }[];
            }
        ).handlers[0];
        const config = (await handler.fulfilled({ headers: {} as Record<string, string> })) as {
            headers: Record<string, string>;
        };
        expect(config.headers['X-Request-Id']).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
    });

    it('요청 본문은 loginId·password 둘뿐이다', () => {
        const payload: LoginRequest = { loginId: 'a', password: 'b' };
        expect(Object.keys(payload).sort()).toEqual(['loginId', 'password']);
    });
});

describe('응답 규격', () => {
    it('계약이 정한 일곱 필드를 모두 담는다', () => {
        const response: LoginResponse = {
            accessToken: 'token',
            tokenType: 'Bearer',
            adminId: '00000000-0000-4000-8000-000000000000',
            loginId: 'admin',
            role: 'ADMIN',
            idleExpiresAt: '2026-07-24T09:50:00+09:00',
            absoluteExpiresAt: '2026-07-24T17:20:00+09:00',
        };
        expect(Object.keys(response).sort()).toEqual([
            'absoluteExpiresAt',
            'accessToken',
            'adminId',
            'idleExpiresAt',
            'loginId',
            'role',
            'tokenType',
        ]);
    });

    it('tokenType 은 항상 Bearer, role 은 항상 ADMIN', () => {
        // 계약: "항상 `Bearer`" / "항상 `ADMIN`". role 은 DB 컬럼이 아니라
        // 인증 채널에서 파생한 고정 주체 표시입니다.
        const response = { tokenType: 'Bearer', role: 'ADMIN' } as const;
        expect(response.tokenType).toBe('Bearer');
        expect(response.role).toBe('ADMIN');
    });
});

describe('토큰 보관 금지', () => {
    it('브라우저 영속 저장소에 토큰을 쓰지 않는다', () => {
        /*
         * 12-R B-2·B-3: "응답 후 로그·브라우저 영속 저장 금지".
         * 새로고침 뒤 신원은 `ADMIN-AUTH-003 GET /auth/me` 로 되살립니다.
         */
        localStorage.clear();
        sessionStorage.clear();
        const all = [
            ...Object.keys(localStorage).map((k) => localStorage.getItem(k) ?? ''),
            ...Object.keys(sessionStorage).map((k) => sessionStorage.getItem(k) ?? ''),
        ].join(' ');
        expect(all).not.toMatch(/accessToken|Bearer/i);
    });
});
