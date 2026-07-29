import { env } from '@/config/env';
import { http } from '@/lib/axios';
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
 * 역할이 `ADMIN` 이 아니면 `403 ADMIN_ROLE_REQUIRED` 이고 화면에서 401 과 구분해 처리합니다.
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

    return {
        // 목업 토큰. 어디에도 저장되지 않고 메모리에만 머뭅니다.
        accessToken: `mock.${Date.now().toString(36)}`,
        tokenType: 'Bearer',
        adminId: DEMO_ADMIN_ID,
        loginId: loginId.trim(),
        role: 'ADMIN',
        ...expiryFromNow(),
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
     * ADMIN-AUTH-003 — 새로고침 뒤 세션 복원에 씁니다.
     *
     * Bearer 토큰은 메모리에만 있어서 새로고침하면 사라집니다. 이 호출이 성공하려면
     * 백엔드가 httpOnly 세션 쿠키를 함께 내려 줘야 합니다 (axios `withCredentials: true`).
     */
    me: async (): Promise<MeResponse> => {
        if (env.mockAuth) throw new Error('ADMIN_SESSION_EXPIRED');

        const { data } = await http.get<MeResponse>('/auth/me');
        return data;
    },

    /** ADMIN-AUTH-002 — 멱등입니다. */
    logout: async (): Promise<LogoutResponse> => {
        if (env.mockAuth) return { loggedOut: true };

        const { data } = await http.post<LogoutResponse>('/auth/logout');
        return data;
    },
};
