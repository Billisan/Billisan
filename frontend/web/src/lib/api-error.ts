import type { AdminErrorCode } from '@/shared/types/api';

/**
 * API 호출 실패를 표현하는 표준 에러.
 * axios 인터셉터에서 백엔드 공통 에러 응답을 이 형태로 변환해 throw 합니다.
 *
 * `code` 가 핵심입니다. HTTP 상태만으로는 부족해요 —
 * `401` 하나에 `INVALID_ADMIN_CREDENTIALS`(자격 틀림)와 `ADMIN_SESSION_EXPIRED`(세션 끊김)가
 * 같이 들어오고, 화면에서 보여줄 문구가 서로 다릅니다 (API명세 B-5).
 */
export class ApiRequestError extends Error {
    readonly statusCode: number;
    /** 백엔드 오류 코드. 봉투에 없으면 undefined 입니다. */
    readonly code?: string;
    readonly path?: string;

    constructor(params: { message: string; statusCode: number; code?: string; path?: string }) {
        super(params.message);
        this.name = 'ApiRequestError';
        this.statusCode = params.statusCode;
        this.code = params.code;
        this.path = params.path;
    }

    is(code: AdminErrorCode): boolean {
        return this.code === code;
    }
}

/** unknown 으로 잡힌 예외에서 오류 코드를 꺼냅니다. */
export function errorCodeOf(error: unknown): string | undefined {
    return error instanceof ApiRequestError ? error.code : undefined;
}

/**
 * unknown 으로 잡힌 예외에서 HTTP 상태를 꺼냅니다.
 *
 * 코드가 없을 때 쓰는 차선책입니다. 계약이 이름을 정해 둔 오류는 `code` 로 가르는 게
 * 맞지만, **`429` 는 이름이 없습니다** — 화면흐름 §15 가 "로그인 실패 횟수 제한, 잠금 …
 * 은 `DEFERRED_NOT_CONTRACTED" 로 미뤄 두었기 때문입니다. 그런데 §7.1 은 로그인 실패를
 * `401·403·429` 로 구분하라고 합니다. 이름이 없으니 상태로 가릅니다.
 */
export function errorStatusOf(error: unknown): number | undefined {
    return error instanceof ApiRequestError ? error.statusCode : undefined;
}
