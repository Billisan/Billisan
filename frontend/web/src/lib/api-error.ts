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
