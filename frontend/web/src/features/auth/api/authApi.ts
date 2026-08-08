import { env } from '@/config/env';
import { http } from '@/lib/axios';
import {
    clearMockSession,
    restoreMockSession,
    saveMockSession,
} from '@/features/auth/mocks/mockSession';
import type {
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    MeResponse,
} from '@/features/auth/types';

/**
 * 관리자 인증 — `ADMIN-AUTH-001/002/003` (12-R B-3).
 *   POST /api/v1/admin/auth/login
 *   POST /api/v1/admin/auth/logout   (멱등)
 *   GET  /api/v1/admin/auth/me
 *
 * 인증 실패는 계정 존재 여부를 구분하지 않고 `401 INVALID_ADMIN_CREDENTIALS` 하나입니다.
 * 관리자 계정이 아니면 `403 ADMIN_ACCOUNT_REQUIRED` 이고 화면에서 401 과 구분해 처리합니다.
 */

/** 목업 관리자. 응답에 이름 필드가 없으므로 loginId 만 있습니다. */
const DEMO_ADMIN_ID = '00000000-0000-4000-8000-000000000001';

const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;

/** 서버가 주는 것과 같은 모양의 만료 시각을 만듭니다. */
function expiryFromNow() {
    const now = Date.now();
    return {
        idleExpiresAt: new Date(now + IDLE_MS).toISOString(),
        absoluteExpiresAt: new Date(now + ABSOLUTE_MS).toISOString(),
    };
}

/** 서버가 붙기 전까지 쓰는 목업 로그인. 계정 값은 실행 환경에서 옵니다. */
async function mockLogin({ loginId, password }: LoginRequest): Promise<LoginResponse> {
    // 왕복이 있는 척해서 로딩 상태를 눈으로 확인할 수 있게 합니다.
    await new Promise((resolve) => setTimeout(resolve, 320));

    const idOk = Boolean(env.demoAdminId) && loginId.trim() === env.demoAdminId;
    const pwOk = Boolean(env.demoAdminPassword) && password === env.demoAdminPassword;

    if (!idOk || !pwOk) {
        // 아이디가 틀렸는지 비밀번호가 틀렸는지 구분해 알려주지 않습니다.
        throw new Error('INVALID_ADMIN_CREDENTIALS');
    }

    const identity = { adminId: DEMO_ADMIN_ID, loginId: loginId.trim(), role: 'ADMIN' } as const;
    const expiry = expiryFromNow();

    // 서버가 세션 쿠키를 심는 자리입니다. 토큰이 아니라 신원·만료만 남습니다.
    saveMockSession(identity, expiry.absoluteExpiresAt);

    return {
        // 목업 토큰. 어디에도 저장되지 않고 메모리에만 머뭅니다.
        accessToken: `mock.${Date.now().toString(36)}`,
        tokenType: 'Bearer',
        ...identity,
        ...expiry,
    };
}

export const authApi = {
    /**
     * ADMIN-AUTH-001.
     *
     * 응답이 관리자 신원과 만료 시각을 함께 줍니다. 로그인 뒤에 `/auth/me` 를 따로 부를
     * 필요가 없습니다.
     */
    login: async (payload: LoginRequest): Promise<LoginResponse> => {
        if (env.mockAuth) return mockLogin(payload);

        const { data } = await http.post<LoginResponse>('/auth/login', payload);
        return data;
    },

    /**
     * 새로고침 뒤 세션 복원.
     *
     * **실 API 모드에서는 서버에 묻지 않습니다.** 예전에는 `GET /auth/me` 를 불렀는데,
     * 그 엔드포인트가 **존재하지 않습니다** — 서버(`AdminAuthController`)에 `/login`
     * 하나뿐이고, 스웨거 스냅샷의 admin 경로 8개에도 없습니다. 부를 때마다
     * `404 NOT_FOUND` 이고, 그 요청이 백엔드 팀 로그에 그대로 쌓입니다.
     *
     * 그래서 관리자 웹은 **새로고침하면 로그아웃**입니다. 토큰이 메모리에만 있고
     * (브라우저 영속 저장 금지 · API명세 B-2) 복원할 창구가 없으니, 그게 지금 계약에서
     * 가능한 유일한 동작입니다. 네트워크를 왕복해 404 를 받고 같은 결론에 이르는 것보다
     * 즉시 로그인 화면으로 보내는 편이 빠르고 조용합니다.
     *
     * TODO: 백엔드에 `GET /admin/auth/me`(+ httpOnly 세션 쿠키)가 생기면 여기서
     *       `http.get('/auth/me')` 로 되돌리세요. 호출부는 그대로 두면 됩니다.
     */
    me: async (): Promise<MeResponse> => {
        if (env.mockAuth) {
            // 세션 쿠키 대신 sessionStorage 를 읽습니다. 만료면 서버의 401 과 같게 던집니다.
            const restored = restoreMockSession();
            if (!restored) throw new Error('ADMIN_SESSION_EXPIRED');
            return restored;
        }

        throw new Error('ADMIN_SESSION_EXPIRED');
    },

    /**
     * 로그아웃 — 멱등입니다. `ADMIN-AUTH-002`.
     *
     * 관리자 인증은 상태 없는 JWT 라 서버에 지울 세션이 없다 — 이 호출은 응답 계약을
     * 만족시키는 확인일 뿐이고, 실제 로그아웃은 클라이언트가 토큰을 버리는 것으로
     * 완성된다(`AppHeader.handleLogout` 이 이어서 `clearAuth` 를 부른다). 그래도 서버
     * 호출 자체는 실패해도 로컬 정리를 막지 않도록 `AppHeader` 쪽에서 순서를 잡는다.
     */
    logout: async (): Promise<LogoutResponse> => {
        if (env.mockAuth) {
            clearMockSession();
            return { loggedOut: true };
        }

        const { data } = await http.post<LogoutResponse>('/auth/logout');
        return data;
    },
};
