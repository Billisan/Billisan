/**
 * 백엔드 공통 응답 규격 (Notion · 팀 컨벤션 > API 설계 규칙 기준).
 *
 * 성공:
 * {
 *   "statusCode": 200,
 *   "timestamp": "...",
 *   "path": "/api/...",
 *   "message": "...",
 *   "data": { ... },
 *   "error": null
 * }
 *
 * 실패:
 * {
 *   ...,
 *   "data": null,
 *   "error": { ... }
 * }
 */
export interface ApiSuccess<T> {
    statusCode: number;
    timestamp: string;
    path: string;
    message: string;
    data: T;
    error: null;
}

export interface ApiError {
    statusCode: number;
    timestamp: string;
    path: string;
    message: string;
    data: null;
    error: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** 페이지네이션 응답의 일반적인 형태 (백엔드 확정되면 맞춰서 수정) */
export interface Paginated<T> {
    content: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
}
