import { env } from '@/config/env';
import { useAuthStore } from '@/features/auth/stores/authStore';
import type { AdminIdentity, MeResponse } from '@/features/auth/types';

/**
 * 목업 세션 저장소 — 백엔드의 **httpOnly 세션 쿠키를 대신합니다.**
 *
 * **새로고침 뒤 세션이 살아남는지는 아직 정해지지 않았습니다.** 계약을 글자 그대로 읽으면
 * 살아남을 수 없습니다 — `ADMIN-AUTH-001` 이 `accessToken` 의 브라우저 영속 저장을
 * 금지하고, `ADMIN-AUTH-003` 은 그 토큰을 `Authorization` 필수로 요구하며, 화면흐름 §15 는
 * "Refresh Token 사용 여부"를 `DEFERRED_NOT_CONTRACTED` 로 미뤄 두었습니다. 셋을 합치면
 * 새로고침마다 재로그인입니다.
 *
 * 다만 §15 가 로그인 화면으로 보내는 경우로 열거한 것은 로그아웃 · 세션 만료
 * (`ACT-WEB-AUTH-003`) · `401` · `403` 뿐이고 새로고침은 없습니다. 그래서 백엔드가
 * httpOnly 세션 쿠키를 함께 내려 줄 여지가 남아 있습니다. 그 경우 `/auth/me` 가 쿠키로
 * 신원을 되돌려 주고 새로고침이 유지됩니다 (axios `withCredentials: true`).
 *
 * 어느 쪽이 되든 화면 코드는 그대로입니다. 쿠키가 없으면 `/auth/me` 가 401 을 내고
 * 로그인 화면으로 가며, 있으면 복원됩니다. **백엔드에 확인이 필요한 항목입니다.**
 *
 * `VITE_MOCK_AUTH=true` 인 동안에는 돌려줄 서버가 없어서 서버가 할 일을 여기서 흉내 냅니다.
 *
 * **토큰은 넣지 않습니다.** 12-R B-2·B-3 이 Bearer 토큰의 브라우저 영속 저장을 금지합니다.
 * 저장하는 값은 `/auth/me` 응답과 같은 신원(`adminId`·`loginId`·`role`)과 만료 시각뿐이고,
 * 금지 필드(비밀번호·얼굴·이미지·카드·장치 Secret)는 하나도 들어가지 않습니다.
 *
 * `localStorage` 가 아니라 `sessionStorage` 를 씁니다. 탭을 닫으면 사라져서 세션 쿠키와
 * 수명이 같습니다.
 *
 * TODO: 백엔드가 세션 쿠키를 내려 주면 이 파일과 `authApi` 의 목업 분기를 함께 지우세요.
 */

const STORAGE_KEY = 'billisan.admin.session';

const IDLE_MS = 30 * 60 * 1000;

interface SessionRecord extends AdminIdentity {
    /** 로그인 기준 절대 만료. 무엇을 하든 되감기지 않습니다 (DEC-SESSION-001). */
    absoluteExpiresAt: string;
    /** 마지막 활동 시각. 유휴 30분 판정 기준입니다. */
    lastActiveAt: number;
}

/** sessionStorage 접근 자체가 막힌 환경(SSR·프라이버시 모드)에서도 앱이 죽지 않게 합니다. */
function storage(): Storage | null {
    try {
        return typeof window === 'undefined' ? null : window.sessionStorage;
    } catch {
        return null;
    }
}

function read(): SessionRecord | null {
    const store = storage();
    if (!store) return null;

    try {
        const raw = store.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<SessionRecord>;
        if (!parsed.adminId || !parsed.loginId || !parsed.absoluteExpiresAt) return null;
        return {
            adminId: parsed.adminId,
            loginId: parsed.loginId,
            role: 'ADMIN',
            absoluteExpiresAt: parsed.absoluteExpiresAt,
            lastActiveAt: parsed.lastActiveAt ?? 0,
        };
    } catch {
        // 손상된 값은 없는 것으로 봅니다.
        return null;
    }
}

function write(record: SessionRecord) {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(record));
}

export function clearMockSession() {
    storage()?.removeItem(STORAGE_KEY);
}

/** 로그인 성공 시점의 세션을 남깁니다. `accessToken` 은 일부러 받지 않습니다. */
export function saveMockSession(admin: AdminIdentity, absoluteExpiresAt: string) {
    write({ ...admin, absoluteExpiresAt, lastActiveAt: Date.now() });
}

/**
 * 저장된 세션을 `ADMIN-AUTH-003` 응답 모양으로 되돌립니다.
 *
 * 만료 판정은 서버와 같은 두 시계입니다 — 유휴 30분(마지막 활동 기준), 절대 8시간(로그인 기준).
 * 만료됐으면 흔적을 지우고 `null` 을 돌려주며, 호출부는 그걸 `401` 과 똑같이 다룹니다.
 *
 * 살아 있으면 `idleExpiresAt` 을 지금 기준으로 다시 밀어 줍니다. 실 서버도 요청을 받을
 * 때마다 이 값을 밀어 주므로 (`types/index.ts` 의 `SessionExpiry` 주석) 동작이 같습니다.
 */
export function restoreMockSession(): MeResponse | null {
    const record = read();
    if (!record) return null;

    const now = Date.now();
    const absoluteOver = Date.parse(record.absoluteExpiresAt) <= now;
    const idleOver = now - record.lastActiveAt >= IDLE_MS;

    if (absoluteOver || idleOver) {
        clearMockSession();
        return null;
    }

    // 새로고침도 활동입니다. 유휴 시계만 되감고 절대 시계는 그대로 둡니다.
    write({ ...record, lastActiveAt: now });

    return {
        adminId: record.adminId,
        loginId: record.loginId,
        role: record.role,
        idleExpiresAt: new Date(now + IDLE_MS).toISOString(),
        absoluteExpiresAt: record.absoluteExpiresAt,
    };
}

/**
 * 화면 활동을 저장된 세션에도 반영합니다.
 *
 * 실 서버라면 관리자가 화면을 쓰는 동안 조회 요청이 오가면서 서버 쪽 유휴 시계가 밀립니다.
 * 목업에는 그 요청이 없어서, 두 시간 동안 일하다 새로고침하면 "유휴 만료"로 잘못 튕깁니다.
 * 그래서 `authStore.touch()` 가 갱신하는 활동 시각을 여기에도 그대로 옮깁니다.
 *
 * `useSessionWatch` 가 이미 30초로 throttle 한 뒤 `touch()` 를 부르므로 쓰기가 잦지 않습니다.
 */
if (env.mockAuth) {
    useAuthStore.subscribe((state, prev) => {
        if (!state.admin) {
            // 로그아웃·만료로 스토어가 비면 저장된 세션도 함께 지웁니다 (화면흐름 §15).
            if (prev.admin) clearMockSession();
            return;
        }
        if (state.lastActiveAt && state.lastActiveAt !== prev.lastActiveAt) {
            const record = read();
            if (record) write({ ...record, lastActiveAt: state.lastActiveAt });
        }
    });
}
