import { useEffect } from 'react';

import { env } from '@/config/env';
import { isSessionAlive, useAuthStore } from '@/features/auth/stores/authStore';

/**
 * 세션 유휴·절대 만료 감시 — `DEC-SESSION-001` (API명세 B-2).
 *
 * 계약: "유휴 만료 30분, 절대 만료 8시간을 적용하며 만료 중 명령은 성공으로 추정하지 않고
 *        재로그인 후 대상을 재조회한다."
 *
 * 시계가 두 개고 성격이 다릅니다.
 *   유휴 — 마지막 **활동**부터 30분. 활동이 있으면 되감깁니다.
 *   절대 — **로그인**부터 8시간. 무엇을 하든 되감기지 않습니다.
 *
 * 예전에는 '활동'을 페이지 이동으로만 봤습니다. 그래서 두 가지가 어긋났습니다.
 *   1) 한 화면에서 계속 일해도 유휴로 판정돼 튕겼습니다.
 *   2) 자리를 비워도 만료를 알아채는 쪽이 없어서 화면이 계속 열려 있었습니다.
 *      유휴 만료를 두는 목적 자체가 2번을 막는 것인데 그게 작동하지 않았습니다.
 */

/**
 * 활동 이벤트를 얼마나 자주 반영할지.
 *
 * 이벤트마다 스토어를 쓰면 스크롤 한 번에 수십 번 씁니다. 유휴 기준이 30분이라
 * 30초 간격이면 정확도에 아무 영향이 없습니다.
 */
const ACTIVITY_THROTTLE_MS = 30 * 1000;

/** 만료를 확인하는 주기. 30분 기준에서 1분 오차는 충분합니다. */
const SESSION_CHECK_INTERVAL_MS = 60 * 1000;

/** 사용자가 화면을 쓰고 있다고 볼 이벤트. 마우스 이동은 뺐습니다 — 커서를 스치기만 해도 잡힙니다. */
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;

export function useSessionWatch() {
    const isAuthenticated = useAuthStore((s) => s.admin !== null);
    const touch = useAuthStore((s) => s.touch);
    const clearAuth = useAuthStore((s) => s.clearAuth);

    useEffect(() => {
        // 우회 모드거나 아직 로그인 전이면 감시할 세션이 없습니다.
        if (env.authBypass || !isAuthenticated) return;

        let lastTouchedAt = Date.now();

        const onActivity = () => {
            const now = Date.now();
            if (now - lastTouchedAt < ACTIVITY_THROTTLE_MS) return;
            lastTouchedAt = now;
            touch();
        };

        /**
         * 만료됐으면 흔적을 지웁니다.
         *
         * 여기서 직접 화면을 옮기지 않습니다. `clearAuth()` 로 user 가 비면 ProtectedRoute 가
         * 다시 그려지면서 로그인으로 보냅니다 — 이동 경로를 한 군데로 모아 둡니다.
         */
        const check = () => {
            if (!isSessionAlive()) clearAuth();
        };

        /**
         * 탭이 다시 보이면 즉시 확인합니다.
         *
         * 브라우저는 백그라운드 탭의 타이머를 늦춥니다. 그대로 두면 자리를 비웠다 돌아왔을 때
         * 만료된 화면이 잠깐 그대로 보입니다.
         */
        const onVisible = () => {
            if (document.visibilityState === 'visible') check();
        };

        ACTIVITY_EVENTS.forEach((type) =>
            window.addEventListener(type, onActivity, { passive: true }),
        );
        document.addEventListener('visibilitychange', onVisible);
        const timer = window.setInterval(check, SESSION_CHECK_INTERVAL_MS);

        return () => {
            ACTIVITY_EVENTS.forEach((type) => window.removeEventListener(type, onActivity));
            document.removeEventListener('visibilitychange', onVisible);
            window.clearInterval(timer);
        };
    }, [isAuthenticated, touch, clearAuth]);
}
