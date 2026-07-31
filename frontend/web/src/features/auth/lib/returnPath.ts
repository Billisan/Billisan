/**
 * 로그인 뒤 돌아갈 곳 — 화면흐름 §15 "현재 URL을 안전하게 저장하고 로그인 후 복귀 가능
 * 여부를 결정한다".
 *
 * `ProtectedRoute` 가 튕겨낼 때 `state.from` 에 담아 둔 값을 해석합니다.
 *
 * **읽는 곳이 둘입니다.** `useLogin` 의 `onSuccess` 와 `LoginPage` 의 이미-로그인됨
 * 분기가 각각 이동시키는데, 로그인 성공 순간에는 둘이 거의 동시에 돕니다. 규칙이
 * 어긋나면 한쪽이 다른 쪽을 덮어써서 "가끔 복귀가 안 되는" 버그가 됩니다. 그래서 판정을
 * 이 파일 하나로 모읍니다.
 */

/**
 * **같은 출처 안의 경로만 받습니다.** `from` 은 주소창을 거쳐 들어올 수 있는 값이라,
 * 그대로 믿고 `navigate` 하면 `//evil.example` 같은 값으로 바깥 사이트에 보낼 수
 * 있습니다(open redirect). 로그인 직후는 그런 유도가 가장 잘 먹히는 순간입니다.
 *
 * `/login` 으로 되돌아가는 것도 막습니다 — 로그인하자마자 로그인 화면이면 갇힙니다.
 */
export function safeReturnPath(from: unknown): string {
    if (typeof from !== 'object' || from === null) return '/';

    const { pathname, search, hash } = from as {
        pathname?: unknown;
        search?: unknown;
        hash?: unknown;
    };
    if (typeof pathname !== 'string') return '/';

    // 반드시 '/' 로 시작하고, '//' 나 '/\' 로 시작하면 안 됩니다 (프로토콜 상대 URL).
    if (!/^\/(?![/\\])/.test(pathname)) return '/';
    if (pathname === '/login') return '/';

    return (
        pathname +
        (typeof search === 'string' ? search : '') +
        (typeof hash === 'string' ? hash : '')
    );
}

/** `useLocation().state` 에서 복귀 경로를 꺼냅니다. */
export function returnPathOf(state: unknown): string {
    return safeReturnPath((state as { from?: unknown } | null)?.from);
}
