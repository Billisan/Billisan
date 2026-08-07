import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * 관리자 인증이 **실재하는 엔드포인트만** 부르는지 봅니다.
 *
 * 예전에는 `GET /auth/me` 와 `POST /auth/logout` 을 불렀는데 서버에 없어서 매번
 * 404 였습니다. 증상이 조용해서 위험했습니다 — `/auth/me` 는 결과가 「로그인 화면으로」라
 * 정상처럼 보였고, `/auth/logout` 은 **정상 로그아웃에도** 경고 토스트를 띄웠습니다.
 * 둘 다 백엔드 팀 서버 로그에 404 를 쌓았고, 목업 모드로 개발하는 동안에는 한 번도
 * 드러나지 않았습니다 — 목업 분기가 네트워크 앞에서 갈라지니까요.
 *
 * **`/auth/logout` 은 서버가 만들어서(BILL-107) 호출을 되살렸습니다.**
 * `/auth/me` 는 여전히 없어서 네트워크를 안 탑니다.
 *
 * 이 파일이 `authApi.test.ts` 와 분리된 이유: 그쪽은 진짜 `env`(목업 모드)를 읽어
 * 검증하는데, 여기서는 실 API 모드를 흉내내야 해서 `env` 를 통째로 갈아끼웁니다.
 */

vi.mock('@/config/env', () => ({
    env: {
        mockAuth: false,
        useMockData: false,
        apiBaseUrl: '/api/v1/admin',
        authBypass: false,
        demoAdminId: '',
        demoAdminPassword: '',
    },
}));

const httpSpies = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock('@/lib/axios', () => ({ http: httpSpies }));

afterEach(() => {
    vi.clearAllMocks();
});

describe('실 API 모드 — 없는 경로를 부르지 않는다', () => {
    it('세션 복원은 네트워크를 타지 않고 실패한다', async () => {
        const { authApi } = await import('@/features/auth/api/authApi');

        await expect(authApi.me()).rejects.toThrow();
        expect(httpSpies.get, 'GET 요청이 나갔습니다').not.toHaveBeenCalled();
    });

    it('로그아웃은 서버를 부른다 — 이제 존재하는 경로입니다', async () => {
        /*
         * 무상태 JWT 라 서버에 지울 세션은 없지만(`AdminAuthController.logout` 주석),
         * 계약이 이 호출을 요구합니다. 화면 쪽은 실패해도 로컬 정리를 진행합니다.
         */
        httpSpies.post.mockResolvedValueOnce({ data: { loggedOut: true } });
        const { authApi } = await import('@/features/auth/api/authApi');

        await expect(authApi.logout()).resolves.toEqual({ loggedOut: true });
        expect(httpSpies.post).toHaveBeenCalledWith('/auth/logout');
    });

    it('로그인은 실제로 서버를 부른다 — 이건 존재하는 경로입니다', async () => {
        httpSpies.post.mockResolvedValueOnce({ data: { accessToken: 't' } });
        const { authApi } = await import('@/features/auth/api/authApi');

        await authApi.login({ loginId: 'a', password: 'b' });
        expect(httpSpies.post).toHaveBeenCalledWith('/auth/login', {
            loginId: 'a',
            password: 'b',
        });
    });
});

describe('소스에 유령 경로가 남아 있지 않다', () => {
    /*
     * 위 테스트는 `authApi` 만 봅니다. 다른 파일에서 직접 부르면 안 걸리므로
     * 소스 문자열로 한 번 더 막습니다.
     */
    const sources = ['src/features/auth/api/authApi.ts', 'src/components/layout/AppHeader.tsx'];

    it.each(sources)('%s — /auth/me 호출이 없다 (서버에 없는 경로)', (path) => {
        const source = readFileSync(resolve(process.cwd(), path), 'utf8');
        // 주석 안의 언급은 허용합니다 — 왜 안 부르는지 적어 두어야 하니까요.
        const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

        expect(code, `${path} 가 /auth/me 를 부릅니다`).not.toMatch(/http\.\w+\(\s*[`'"]\/auth\/me/);
    });

    it('스웨거 스냅샷에 admin 인증은 로그인 하나뿐이다', () => {
        /*
         * ⚠️ 스냅샷은 2026-08-03 자라 **낡았습니다** — 그 뒤 서버에 `/auth/logout` 이
         * 생겼습니다(BILL-107). 스냅샷을 다시 받으면 이 단언을 함께 고치세요.
         * `/auth/me` 는 여전히 없습니다.
         */
        const spec = JSON.parse(readFileSync(resolve(process.cwd(), 'docs/api-docs.json'), 'utf8'));
        const authPaths = Object.keys(spec.paths).filter((path) =>
            path.startsWith('/api/v1/admin/auth'),
        );

        expect(authPaths).toEqual(['/api/v1/admin/auth/login']);
    });
});
