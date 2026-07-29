import { create } from 'zustand';

import type { AdminUser, SessionInfo } from '@/features/auth/types';

/**
 * 관리자 세션 기준 — `DEC-SESSION-001 · CONFIRMED · P0`.
 * 유휴 30분, 절대 8시간. 사용자 App 토큰과 관리자 토큰은 분리합니다 (화면흐름 §7.1).
 *
 * 서버가 만료 시각을 주면 그 값이 우선입니다. 아래 상수는 서버가 안 줄 때의 대체값입니다.
 */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const ABSOLUTE_LIFETIME_MS = 8 * 60 * 60 * 1000;

interface AuthState {
    /**
     * Bearer 토큰. **메모리에만 둡니다.**
     *
     * 세션을 쿠키로 복원한 경우에는 null 일 수 있습니다. 그때도 로그인 상태는 유효합니다 —
     * 인증 여부는 토큰이 아니라 `user` 로 판단하세요.
     */
    accessToken: string | null;
    user: AdminUser | null;
    /** 세션 발급 시각 (절대 만료 기준) */
    issuedAt: number | null;
    /** 마지막 활동 시각 (유휴 만료 기준) */
    lastActiveAt: number | null;
    /** 서버가 알려 준 만료 시각. 있으면 클라이언트 계산보다 이걸 씁니다. */
    session: SessionInfo | null;
    setAuth: (payload: {
        accessToken?: string | null;
        user: AdminUser;
        session?: SessionInfo | null;
    }) => void;
    /** 화면을 쓰고 있다는 표시. 유휴 타이머를 되감습니다. */
    touch: () => void;
    clearAuth: () => void;
}

/**
 * 인증 클라이언트 상태.
 *
 * **`persist` 를 걷어냈습니다. 토큰은 메모리에만 둡니다.**
 * API명세 B-2 가 "비밀번호와 Bearer token 은 일반 로그·응답 오류·**브라우저 영속 저장소**에
 * 남기지 않는다"고 못 박았고, 화면흐름 §6.3 도 같은 내용입니다.
 *
 * 그래서 새로고침하면 메모리가 비고, `ADMIN-AUTH-003 GET /auth/me` 로 복원합니다
 * (`useSessionRestore`). 그 호출이 되려면 백엔드가 httpOnly 세션 쿠키를 함께 내려 줘야 합니다.
 */
export const useAuthStore = create<AuthState>()((set) => ({
    accessToken: null,
    user: null,
    issuedAt: null,
    lastActiveAt: null,
    session: null,
    setAuth: ({ accessToken, user, session }) =>
        set({
            accessToken: accessToken ?? null,
            user,
            session: session ?? null,
            issuedAt: Date.now(),
            lastActiveAt: Date.now(),
        }),
    touch: () => set({ lastActiveAt: Date.now() }),
    clearAuth: () =>
        set({
            accessToken: null,
            user: null,
            issuedAt: null,
            lastActiveAt: null,
            session: null,
        }),
}));

/** ISO 문자열이 이미 지났는지. 파싱 실패는 '아직 안 지남'으로 봅니다. */
function isPast(at: string | undefined): boolean {
    if (!at) return false;
    const time = Date.parse(at);
    return Number.isFinite(time) && time <= Date.now();
}

/**
 * 세션이 아직 살아 있는지.
 *
 * 서버가 준 만료 시각이 있으면 그게 기준입니다. 없으면 유휴·절대 만료를 직접 셉니다.
 */
export function isSessionAlive(): boolean {
    const { user, issuedAt, lastActiveAt, session } = useAuthStore.getState();
    if (!user) return false;

    if (session?.expiresAt || session?.idleExpiresAt) {
        return !isPast(session.expiresAt) && !isPast(session.idleExpiresAt);
    }

    if (!issuedAt || !lastActiveAt) return false;
    const now = Date.now();
    return now - issuedAt < ABSOLUTE_LIFETIME_MS && now - lastActiveAt < IDLE_TIMEOUT_MS;
}

/** 스토어 밖(예: axios 인터셉터)에서 토큰을 읽기 위한 헬퍼 */
export const getAccessToken = () => useAuthStore.getState().accessToken;
