import { create } from 'zustand';

import type { AdminIdentity, SessionExpiry } from '@/features/auth/types';

/**
 * 관리자 세션 기준 — `DEC-SESSION-001` (12-R B-3).
 * 유휴 30분, 절대 8시간. 사용자 App 토큰과 관리자 토큰은 분리합니다.
 *
 * 만료 시각의 권위는 **서버**입니다. `idleExpiresAt`·`absoluteExpiresAt` 을 응답으로 줍니다.
 * 다만 `idleExpiresAt` 은 서버가 요청을 받을 때마다 밀어 주는 값이라, 화면에서 클릭만 하고
 * 요청을 안 보내는 동안에는 낡습니다. 그래서 유휴는 **로컬 활동 시각**으로 세고,
 * 절대 만료만 서버 값을 그대로 씁니다. 최종 판정은 어차피 서버의 401 입니다.
 */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const ABSOLUTE_LIFETIME_MS = 8 * 60 * 60 * 1000;

interface AuthState {
    /**
     * Bearer 토큰. **메모리에만 둡니다.**
     *
     * 세션을 쿠키로 복원한 경우에는 null 일 수 있습니다. 그때도 로그인 상태는 유효합니다 —
     * 인증 여부는 토큰이 아니라 `admin` 으로 판단하세요.
     */
    accessToken: string | null;
    /** 인증된 관리자. 응답에 이름이 없어 화면 표시는 `loginId` 를 씁니다. */
    admin: AdminIdentity | null;
    /** 서버가 알려 준 만료 시각 */
    session: SessionExpiry | null;
    /** 세션 발급 시각 (서버 절대 만료가 없을 때의 대체 기준) */
    issuedAt: number | null;
    /** 마지막 활동 시각 (유휴 만료 기준) */
    lastActiveAt: number | null;
    setAuth: (payload: {
        accessToken?: string | null;
        admin: AdminIdentity;
        session?: SessionExpiry | null;
    }) => void;
    /** 화면을 쓰고 있다는 표시. 유휴 타이머를 되감습니다. */
    touch: () => void;
    clearAuth: () => void;
}

/**
 * 인증 클라이언트 상태.
 *
 * **`persist` 를 쓰지 않습니다. 토큰은 메모리에만 둡니다.**
 * 12-R B-2: "비밀번호, Bearer token ... 은 일반 로그·오류·응답 DTO에 포함하지 않는다",
 * B-3: "응답 후 로그·브라우저 영속 저장 금지".
 *
 * 새로고침하면 메모리가 비고 `ADMIN-AUTH-003` 으로 복원합니다 (`useSessionRestore`).
 * 그 호출이 되려면 백엔드가 httpOnly 세션 쿠키를 함께 내려 줘야 합니다.
 */
export const useAuthStore = create<AuthState>()((set) => ({
    accessToken: null,
    admin: null,
    session: null,
    issuedAt: null,
    lastActiveAt: null,
    setAuth: ({ accessToken, admin, session }) =>
        set({
            accessToken: accessToken ?? null,
            admin,
            session: session ?? null,
            issuedAt: Date.now(),
            lastActiveAt: Date.now(),
        }),
    touch: () => set({ lastActiveAt: Date.now() }),
    clearAuth: () =>
        set({
            accessToken: null,
            admin: null,
            session: null,
            issuedAt: null,
            lastActiveAt: null,
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
 * 절대 만료는 서버 값이 있으면 그것을, 없으면 발급 시각 + 8시간을 씁니다.
 * 유휴는 항상 로컬 활동 시각으로 셉니다 (위 주석 참고).
 */
export function isSessionAlive(): boolean {
    const { admin, session, issuedAt, lastActiveAt } = useAuthStore.getState();
    if (!admin || !lastActiveAt) return false;

    if (Date.now() - lastActiveAt >= IDLE_TIMEOUT_MS) return false;

    if (session?.absoluteExpiresAt) return !isPast(session.absoluteExpiresAt);
    return issuedAt !== null && Date.now() - issuedAt < ABSOLUTE_LIFETIME_MS;
}

/** 스토어 밖(예: axios 인터셉터)에서 토큰을 읽기 위한 헬퍼 */
export const getAccessToken = () => useAuthStore.getState().accessToken;
