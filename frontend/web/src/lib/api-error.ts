/**
 * API 호출 실패를 표현하는 표준 에러.
 * axios 인터셉터에서 백엔드 공통 에러 응답을 이 형태로 변환해 throw 합니다.
 */
export class ApiRequestError extends Error {
    readonly statusCode: number;
    readonly path?: string;
    readonly error?: unknown;

    constructor(params: { message: string; statusCode: number; path?: string; error?: unknown }) {
        super(params.message);
        this.name = 'ApiRequestError';
        this.statusCode = params.statusCode;
        this.path = params.path;
        this.error = params.error;
    }
}
