import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { env } from '@/config/env';
import { authApi } from '@/features/auth/api/authApi';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { qk } from '@/shared/api/queryKeys';

/**
 * 새로고침 뒤 세션 복원.
 *
 * **`authStore` 가 이제 `localStorage` 에 `persist` 됩니다** (백엔드에 세션 복원
 * 엔드포인트가 없어서 택한 임시 조치 — `authStore.ts` 상단 주석 참고). 그래서 실
 * API 모드에서도 새로고침 직후 이미 `admin` 이 채워져 있는 경우가 대부분이고,
 * 그러면 아래 `enabled` 가 `false` 가 되어 이 훅은 아무 요청도 보내지 않고 바로
 * "복원 끝"으로 처리됩니다.
 *
 * 이 훅 자체는 `authApi.me()` 경로를 여전히 갖고 있습니다 — 목업 모드
 * (`mocks/mockSession.ts` 의 sessionStorage 기반 세션)를 위해서, 그리고 나중에
 * 백엔드가 `GET /admin/auth/me` 를 실제로 만들면 `authApi.me()` 쪽만 되돌리고 이
 * 훅은 그대로 쓸 수 있게 하기 위해서입니다. 실 API 모드에서 `admin` 이 비어 있는
 * 채로 이 훅이 돌면(예: `localStorage` 를 지운 직후) `authApi.me()` 는 네트워크를
 * 타지 않고 곧바로 실패합니다 — 세션 복원 엔드포인트가 아직 없어서입니다.
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
     * 실 API 모드에서는 `authApi.me()` 가 네트워크 없이 즉시 실패합니다 — 복원 창구가
     * 없어서입니다. 쿼리는 그대로 돌리되 한 프레임 만에 끝나고 로그인 화면으로 갑니다.
     * 분기를 여기 두지 않는 이유는, 백엔드가 나중에 `/auth/me` 를 만들면 `authApi` 한
     * 곳만 되돌리면 되게 하기 위해서입니다.
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
