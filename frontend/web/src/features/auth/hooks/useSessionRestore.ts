import { useEffect, useState } from 'react';

import { env } from '@/config/env';
import { authApi } from '@/features/auth/api/authApi';
import { useAuthStore } from '@/features/auth/stores/authStore';

/**
 * 새로고침 뒤 세션 복원 — `ADMIN-AUTH-003 GET /api/v1/admin/auth/me`.
 *
 * Bearer 토큰은 브라우저 영속 저장소에 둘 수 없어서(API명세 B-2) 메모리에만 있고,
 * 새로고침하면 사라집니다. 그래서 부팅할 때 서버에 "나 누구야?"를 한 번 물어봅니다.
 * 이 호출이 성공하려면 백엔드가 **httpOnly 세션 쿠키**를 함께 내려 줘야 합니다
 * (axios 는 `withCredentials: true`).
 *
 * 목업 모드에서는 서버가 없어서 `authApi.me()` 가 sessionStorage 에 남긴 신원을 읽습니다
 * (`mocks/mockSession.ts`). 어느 쪽이든 화면 입장에서는 같은 호출입니다.
 *
 * 실패는 정상 흐름입니다 — 그냥 로그인 안 한 상태라는 뜻이라 조용히 넘어갑니다.
 */

/**
 * 페이지가 로드된 뒤 딱 한 번만 시도합니다.
 *
 * 모듈 스코프에 두는 이유: 보호 라우트가 로그인 화면으로 리다이렉트하면서 언마운트됐다가
 * 다시 마운트되면 컴포넌트 state 로는 재시도를 막을 수 없습니다. 그러면 실패한 `/auth/me` 를
 * 이동할 때마다 다시 부릅니다.
 */
let attempted = false;

/** @returns 복원 시도가 끝났는지. false 인 동안에는 화면을 판단하지 않고 기다립니다. */
export function useSessionRestore(): boolean {
    const admin = useAuthStore((s) => s.admin);
    const setAuth = useAuthStore((s) => s.setAuth);

    /*
     * 우회 모드이거나 이미 로그인돼 있으면 물어볼 필요가 없습니다.
     *
     * **목업 모드는 여기서 건너뛰지 않습니다.** 예전에는 `env.mockAuth` 를 넣어 뒀는데,
     * 그러면 새로고침할 때마다 복원을 아예 시도하지 않아서 무조건 로그인 화면으로
     * 튕겼습니다. 새로고침은 로그아웃이 아닙니다 (화면흐름 §15).
     * 목업 모드의 `authApi.me()` 는 sessionStorage 에서 세션을 되살립니다.
     */
    const skip = env.authBypass || Boolean(admin) || attempted;
    const [settled, setSettled] = useState(skip);

    useEffect(() => {
        if (skip) {
            setSettled(true);
            return;
        }

        attempted = true;
        let cancelled = false;

        authApi
            .me()
            .then(({ adminId, loginId, role, idleExpiresAt, absoluteExpiresAt }) => {
                // 토큰은 못 받습니다. 이후 요청은 세션 쿠키로 인증됩니다.
                if (cancelled) return;
                setAuth({
                    admin: { adminId, loginId, role },
                    session: { idleExpiresAt, absoluteExpiresAt },
                });
            })
            .catch(() => {
                // 401 이면 그냥 비로그인 상태입니다. 오류로 취급하지 않습니다.
            })
            .finally(() => {
                if (!cancelled) setSettled(true);
            });

        return () => {
            cancelled = true;
        };
    }, [skip, setAuth]);

    return settled;
}

/** 로그아웃할 때 호출해, 다음 로그인 전까지 복원을 다시 시도할 수 있게 합니다. */
export function resetSessionRestore() {
    attempted = false;
}
