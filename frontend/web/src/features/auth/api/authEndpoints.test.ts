import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * 관리자 인증이 **실재하는 엔드포인트만** 부르는지 봅니다.
 *
 * 서버 `AdminAuthController` 에는 `POST /api/v1/admin/auth/login` **하나뿐**이고,
 * 스웨거 스냅샷의 admin 경로 8개에도 인증은 로그인 하나입니다. 그런데 예전 코드는
 * `GET /auth/me` 와 `POST /auth/logout` 을 함께 불렀습니다.
 *
 * 증상이 조용해서 위험했습니다.
 *   - `/auth/me` — 새로고침마다 404. 결과가 「로그인 화면으로」라 정상처럼 보입니다.
 *   - `/auth/logout` — 로그아웃마다 404 라, **정상 로그아웃에도** 경고 토스트가 떴습니다.
 *
 * 둘 다 백엔드 팀 서버 로그에 404 를 쌓습니다. 목업 모드로 개발하는 동안에는 한 번도
 * 드러나지 않습니다 — 목업 분기가 네트워크 앞에서 갈라지니까요.
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

    it('로그아웃은 서버를 부르지 않고 성공한다', async () => {
        /*
         * 관리자 인증은 상태 없는 JWT 라 서버에 지울 세션이 없습니다.
         * 토큰을 버리는 것이 로그아웃의 전부이고, 그건 클라이언트에서 끝납니다.
         */
        const { authApi } = await import('@/features/auth/api/authApi');

        await expect(authApi.logout()).resolves.toEqual({ loggedOut: true });
        expect(httpSpies.post, 'POST 요청이 나갔습니다').not.toHaveBeenCalled();
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

    it.each(sources)('%s — /auth/me · /auth/logout 호출이 없다', (path) => {
        const source = readFileSync(resolve(process.cwd(), path), 'utf8');
        // 주석 안의 언급은 허용합니다 — 왜 안 부르는지 적어 두어야 하니까요.
        const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

        expect(code, `${path} 가 /auth/me 를 부릅니다`).not.toMatch(/http\.\w+\(\s*[`'"]\/auth\/me/);
        expect(code, `${path} 가 /auth/logout 을 부릅니다`).not.toMatch(
            /http\.\w+\(\s*[`'"]\/auth\/logout/,
        );
    });

    it('스웨거 스냅샷에 admin 인증은 로그인 하나뿐이다', () => {
        /*
         * 이 사실이 바뀌면(백엔드가 `/auth/me` 를 만들면) 위 결정을 되돌려야 합니다.
         * 그때 이 테스트가 먼저 깨져서 알려 줍니다.
         */
        const spec = JSON.parse(readFileSync(resolve(process.cwd(), 'docs/api-docs.json'), 'utf8'));
        const authPaths = Object.keys(spec.paths).filter((path) =>
            path.startsWith('/api/v1/admin/auth'),
        );

        expect(authPaths).toEqual(['/api/v1/admin/auth/login']);
    });
});
