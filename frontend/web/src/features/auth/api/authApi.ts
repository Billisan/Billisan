import { env } from '@/config/env';
import { http } from '@/lib/axios';
import type {
    AdminUser,
    LoginRequest,
    LoginResponse,
    MeResponse,
    SessionInfo,
} from '@/features/auth/types';
import { CAMPUS_NAME } from '@/shared/constants/organization';

/**
 * 관리자 인증 — `ADMIN-AUTH-001/002/003` (API명세 B-2).
 *   POST /api/v1/admin/auth/login
 *   POST /api/v1/admin/auth/logout   (멱등)
 *   GET  /api/v1/admin/auth/me
 *
 * 인증 실패는 계정 존재 여부를 구분하지 않고 `401 INVALID_ADMIN_CREDENTIALS` 하나입니다.
 * 역할이 `ADMIN` 이 아니면 `403 ADMIN_ROLE_REQUIRED` 이고 화면에서 401 과 구분해 처리합니다.
 * 비밀번호는 요청 본문에만 담기고 저장·로그·재사용하지 않습니다 (B-2 · 화면흐름 §7.1).
 */

/** 시연용 관리자. 계정 판정은 행 존재 + `role=ADMIN` 뿐입니다 (§6.3). */
const DEMO_ADMIN: AdminUser = {
    // ERD PK 는 UUID 입니다. 목업도 같은 모양으로 둬야 연동 때 타입이 안 흔들립니다.
    userId: '00000000-0000-4000-8000-000000000001',
    loginId: env.demoAdminId || 'fixture-6cf786909c73@example.invalid',
    name: `${CAMPUS_NAME}_관리자`,
    role: 'ADMIN',
};

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
        user: DEMO_ADMIN,
    };
}

/** `/auth/me` 응답이 user 를 그대로 주든 `{user, session}` 으로 감싸 주든 같게 만듭니다. */
function normalizeMe(body: MeResponse): { user: AdminUser; session?: SessionInfo } {
    if ('user' in body) return { user: body.user, session: body.session };
    return { user: body };
}

export const authApi = {
    /**
     * ADMIN-AUTH-001.
     *
     * 응답에 관리자 정보가 없으면 이어서 `/auth/me` 를 부릅니다.
     * 계약에 로그인 응답 DTO 가 없어서 어느 쪽이 오든 동작하게 둡니다.
     */
    login: async (payload: LoginRequest): Promise<LoginResponse> => {
        if (env.mockAuth) return mockLogin(payload);

        const { data } = await http.post<LoginResponse>('/auth/login', payload);
        if (data.user) return data;

        const me = await authApi.me();
        return { ...data, user: me.user, session: me.session ?? data.session };
    },

    /**
     * ADMIN-AUTH-003 — 새로고침 뒤 세션 복원에 씁니다.
     *
     * Bearer 토큰은 메모리에만 있어서 새로고침하면 사라집니다. 이 호출이 성공하려면
     * 백엔드가 httpOnly 세션 쿠키를 함께 내려 줘야 합니다 (axios `withCredentials: true`).
     */
    me: async (): Promise<{ user: AdminUser; session?: SessionInfo }> => {
        if (env.mockAuth) throw new Error('ADMIN_SESSION_EXPIRED');

        const { data } = await http.get<MeResponse>('/auth/me');
        return normalizeMe(data);
    },

    /** ADMIN-AUTH-002 — 멱등입니다. */
    logout: async (): Promise<void> => {
        if (env.mockAuth) return;

        await http.post('/auth/logout');
    },
};
