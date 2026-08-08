import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * 관리자 인증이 **실재하는 엔드포인트만** 부르는지 봅니다.
 *
 * 서버 `AdminAuthController` 는 `POST /api/v1/admin/auth/login` 과
 * `POST /api/v1/admin/auth/logout` 을 갖고 있습니다(`GET /auth/me` 는 아직 없음 —
 * 세션 복원 엔드포인트라 새로고침 로그아웃 문제와 얽혀 있고, 별도로 다룹니다).
 *
 * `/auth/me` 를 잘못 부르면 증상이 조용해서 위험합니다 — 새로고침마다 404 인데
 * 결과가 「로그인 화면으로」라 정상처럼 보이고, 백엔드 팀 서버 로그에만 쌓입니다.
 * 목업 모드로 개발하는 동안에는 한 번도 드러나지 않습니다 — 목업 분기가 네트워크
 * 앞에서 갈라지니까요.
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

    it('로그아웃은 실제로 서버를 부른다 — 이건 존재하는 경로입니다', async () => {
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
     * 소스 문자열로 한 번 더 막습니다. `/auth/logout` 은 이제 실재하는 경로라
     * 여기서 막지 않습니다 — `authApi.logout()` 을 통해서만 부르는지는 위
     * '로그아웃은 실제로 서버를 부른다' 테스트가 봅니다.
     */
    const sources = ['src/features/auth/api/authApi.ts', 'src/components/layout/AppHeader.tsx'];

    it.each(sources)('%s — /auth/me 호출이 없다', (path) => {
        const source = readFileSync(resolve(process.cwd(), path), 'utf8');
        // 주석 안의 언급은 허용합니다 — 왜 안 부르는지 적어 두어야 하니까요.
        const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

        expect(code, `${path} 가 /auth/me 를 부릅니다`).not.toMatch(/http\.\w+\(\s*[`'"]\/auth\/me/);
    });

    it('스웨거 스냅샷에 admin 인증은 로그인뿐이다 (스냅샷 갱신 전까지는 정상)', () => {
        /*
         * `docs/api-docs.json` 은 2026-08-03 에 받아둔 스냅샷이라 그 뒤에 배포된
         * `/auth/logout` 을 아직 반영하지 못합니다(`docs/README.md` 참고 — 갱신은
         * 수동입니다). 이 테스트는 스냅샷이 실제로 그 상태인지만 확인합니다.
         * `/auth/me` 가 스펙에 나타나면 여기가 깨지면서 세션 복원을 다시 붙일 수
         * 있다는 신호가 됩니다.
         */
        const spec = JSON.parse(readFileSync(resolve(process.cwd(), 'docs/api-docs.json'), 'utf8'));
        const authPaths = Object.keys(spec.paths).filter((path) =>
            path.startsWith('/api/v1/admin/auth'),
        );

        expect(authPaths).toEqual(['/api/v1/admin/auth/login']);
    });
});
