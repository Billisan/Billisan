import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    ABSOLUTE_LIFETIME_MS,
    IDLE_TIMEOUT_MS,
    isSessionAlive,
    useAuthStore,
} from '@/features/auth/stores/authStore';

/**
 * 관리자 세션 만료 — `DEC-SESSION-001`, `ADMIN-AUTH-001` 의 `idleExpiresAt`·`absoluteExpiresAt`.
 *
 * 계약이 "마지막 활동 기준 30분", "로그인 기준 최대 8시간"을 정했습니다. 시계가 둘이고
 * 성격이 다릅니다 — 유휴는 활동이 있으면 되감기고, 절대는 무엇을 하든 되감기지 않습니다.
 *
 * 이 판정이 틀리면 두 방향 모두 나쁩니다. 느슨하면 자리를 비운 관리자 화면이 열린 채
 * 남고, 빡빡하면 일하는 중에 튕깁니다. 그런데 30분·8시간짜리라 손으로는 확인할 수
 * 없습니다. 그래서 시계를 세워 두고 경계를 직접 넘겨 봅니다.
 */

const ADMIN = { adminId: 'a-1', loginId: 'admin01', role: 'ADMIN' } as const;
const T0 = new Date('2026-07-31T09:00:00+09:00').getTime();

/** 로그인 직후 상태를 만듭니다. `absoluteExpiresAt` 은 서버가 주는 값입니다. */
function login(absoluteExpiresAt?: string) {
    useAuthStore.getState().setAuth({
        accessToken: 'tok',
        admin: { ...ADMIN },
        session: {
            idleExpiresAt: new Date(T0 + IDLE_TIMEOUT_MS).toISOString(),
            absoluteExpiresAt:
                absoluteExpiresAt ?? new Date(T0 + ABSOLUTE_LIFETIME_MS).toISOString(),
        },
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    useAuthStore.getState().clearAuth();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('isSessionAlive', () => {
    it('로그인 전에는 살아 있지 않다', () => {
        expect(isSessionAlive()).toBe(false);
    });

    it('로그인 직후에는 살아 있다', () => {
        login();
        expect(isSessionAlive()).toBe(true);
    });

    describe('유휴 30분', () => {
        it('29분 59초까지는 살아 있다', () => {
            login();
            vi.setSystemTime(T0 + IDLE_TIMEOUT_MS - 1000);
            expect(isSessionAlive()).toBe(true);
        });

        it('정확히 30분이 되면 끊긴다', () => {
            login();
            vi.setSystemTime(T0 + IDLE_TIMEOUT_MS);
            expect(isSessionAlive()).toBe(false);
        });

        /** 활동이 있으면 되감깁니다 — 한 화면에서 계속 일하는 사람이 튕기면 안 됩니다. */
        it('중간에 활동하면 그 시점부터 다시 30분', () => {
            login();
            vi.setSystemTime(T0 + 29 * 60 * 1000);
            useAuthStore.getState().touch();

            vi.setSystemTime(T0 + 29 * 60 * 1000 + IDLE_TIMEOUT_MS - 1000);
            expect(isSessionAlive()).toBe(true);

            vi.setSystemTime(T0 + 29 * 60 * 1000 + IDLE_TIMEOUT_MS);
            expect(isSessionAlive()).toBe(false);
        });
    });

    describe('절대 8시간', () => {
        /**
         * 절대 만료는 되감기지 않습니다. 계속 활동해도 8시간이면 끝입니다.
         * 여기서 `touch()` 로 유휴를 계속 밀어 두어, 끊기는 이유가 절대 만료임을 못박습니다.
         */
        it('활동을 계속해도 8시간이면 끊긴다', () => {
            login();
            for (let m = 10; m < 8 * 60; m += 10) {
                vi.setSystemTime(T0 + m * 60 * 1000);
                useAuthStore.getState().touch();
                expect(isSessionAlive()).toBe(true);
            }
            vi.setSystemTime(T0 + ABSOLUTE_LIFETIME_MS);
            useAuthStore.getState().touch();
            expect(isSessionAlive()).toBe(false);
        });

        /** 만료 시각의 권위는 서버입니다. 서버가 짧게 주면 그걸 따릅니다. */
        it('서버가 준 absoluteExpiresAt 이 8시간보다 짧으면 그쪽을 따른다', () => {
            login(new Date(T0 + 60 * 60 * 1000).toISOString()); // 1시간
            vi.setSystemTime(T0 + 59 * 60 * 1000);
            useAuthStore.getState().touch();
            expect(isSessionAlive()).toBe(true);

            vi.setSystemTime(T0 + 61 * 60 * 1000);
            useAuthStore.getState().touch();
            expect(isSessionAlive()).toBe(false);
        });
    });

    it('clearAuth 하면 즉시 끊긴다', () => {
        login();
        useAuthStore.getState().clearAuth();
        expect(isSessionAlive()).toBe(false);
    });
});

describe('토큰 보관 (B-2)', () => {
    /** 계약: "응답 후 로그·브라우저 영속 저장 금지". 스토어는 메모리라 새로고침하면 사라집니다. */
    it('clearAuth 는 토큰까지 지운다', () => {
        login();
        expect(useAuthStore.getState().accessToken).toBe('tok');
        useAuthStore.getState().clearAuth();
        expect(useAuthStore.getState().accessToken).toBeNull();
        expect(useAuthStore.getState().admin).toBeNull();
        expect(useAuthStore.getState().session).toBeNull();
    });
});
