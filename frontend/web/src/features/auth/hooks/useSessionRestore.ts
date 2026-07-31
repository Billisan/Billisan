import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { env } from '@/config/env';
import { authApi } from '@/features/auth/api/authApi';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { qk } from '@/shared/api/queryKeys';

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
 *
 * ---
 *
 * **`useQuery` 로 맡깁니다** (MR !8 리뷰 반영).
 *
 * 예전에는 모듈 전역 `attempted` + `useEffect` + 로컬 `settled` 로 "한 번만 호출하고
 * 끝날 때까지 기다린다"를 손으로 만들었습니다. 전역 가변 변수는 React 밖에 있어서
 * 동시성 렌더링에서 어긋날 수 있고, 취소 플래그도 직접 관리해야 했습니다.
 *
 * 세 가지를 쿼리가 대신합니다.
 *   - "한 번만" — 같은 `queryKey` 캐시. `staleTime: Infinity` 라 다시 안 부릅니다.
 *   - "기다린다" — `isPending`.
 *   - "재시도 금지" — `retry: false`. 401 은 오류가 아니라 비로그인 상태입니다.
 */

/** @returns 복원 시도가 끝났는지. false 인 동안에는 화면을 판단하지 않고 기다립니다. */
export function useSessionRestore(): boolean {
    const admin = useAuthStore((s) => s.admin);
    const setAuth = useAuthStore((s) => s.setAuth);

    /*
     * 우회 모드이거나 이미 로그인돼 있으면 물어볼 필요가 없습니다.
     *
     * **목업 모드는 여기서 건너뛰지 않습니다.** 예전에는 `env.mockAuth` 를 넣어 뒀는데,
     * 그러면 새로고침할 때마다 복원을 아예 시도하지 않아서 무조건 로그인 화면으로
     * 튕겼습니다. 목업 모드의 `authApi.me()` 는 sessionStorage 에서 세션을 되살립니다.
     *
     * 실 API 모드에서 이 호출이 성공하려면 백엔드가 httpOnly 세션 쿠키를 함께 내려 줘야
     * 합니다. 계약에 쿠키 얘기는 없고 `ADMIN-AUTH-003` 은 `Authorization` 을 필수로
     * 적어 두었는데, 그 토큰은 새로고침하면 메모리에서 사라집니다. 쿠키가 없으면 여기서
     * 401 이 나고 로그인 화면으로 갑니다 — 그게 계약대로의 동작입니다.
     * 요청 한 번 값이라, 백엔드가 나중에 쿠키를 붙이면 그때부터 복원이 그냥 됩니다.
     */
    const enabled = !env.authBypass && !admin;

    const query = useQuery({
        queryKey: qk.auth.me,
        queryFn: authApi.me,
        enabled,
        // 401 은 "로그인 안 함"입니다. 재시도할 이유가 없습니다.
        retry: false,
        /*
         * 부팅에 한 번이면 충분합니다. 화면을 옮길 때마다 다시 물어보지 않게 막습니다 —
         * 예전 전역 `attempted` 플래그가 하던 일입니다.
         */
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });

    const restored = query.data;

    useEffect(() => {
        if (!restored) return;
        const { adminId, loginId, role, idleExpiresAt, absoluteExpiresAt } = restored;
        // 토큰은 못 받습니다. 이후 요청은 세션 쿠키로 인증됩니다.
        setAuth({
            admin: { adminId, loginId, role },
            session: { idleExpiresAt, absoluteExpiresAt },
        });
    }, [restored, setAuth]);

    /*
     * 물어볼 필요가 없으면 기다릴 것도 없습니다.
     *
     * 다만 **응답이 왔다고 바로 끝났다고 하면 안 됩니다.** `setAuth` 는 위 `useEffect` 라
     * 렌더가 끝난 뒤에 돕니다. 그 한 프레임 동안 `isPending` 은 이미 false 인데 스토어의
     * `admin` 은 아직 null 이라, 보호 라우트가 "세션 없음"으로 보고 로그인 화면으로
     * 보내 버립니다 — 새로고침하면 보던 주소를 잃습니다.
     * 그래서 복원에 성공했으면 스토어에 반영될 때까지 한 박자 더 기다립니다.
     */
    const stored = !query.data || Boolean(admin);

    return !enabled || (!query.isPending && stored);
}

/**
 * 로그아웃할 때 호출해, 다음 로그인 전까지 복원을 다시 시도할 수 있게 합니다.
 *
 * 캐시를 지워야 합니다. `staleTime: Infinity` 라 그냥 두면 다음 사람이 로그인 화면에
 * 들어와도 이전 세션의 응답이 그대로 남아 있습니다.
 */
export function useResetSessionRestore() {
    const queryClient = useQueryClient();
    return () => queryClient.removeQueries({ queryKey: qk.auth.me });
}
