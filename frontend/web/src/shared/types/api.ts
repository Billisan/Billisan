/**
 * 백엔드 공통 응답 규격.
 *
 * **두 가지 모양을 모두 받습니다.** 지금 두 문서가 서로 다른 봉투를 말하고 있어서,
 * 어느 쪽이 오든 깨지지 않게 해 둡니다.
 *
 *   (A) API명세 12번 PART B  — `{ success, data, meta{requestId,timestamp} }`
 *       오류는 `{ success:false, error{code,message,retryable,details}, meta }`
 *   (B) 팀 API 설계 규칙      — `{ statusCode, timestamp, path, message, data, error }`
 *
 * TODO: 백엔드 담당자와 한쪽으로 확정되면 반대쪽 분기를 지우세요.
 *       12번이 P0 정식 계약이라 (A) 가 기본이어야 하지만, 팀 공통 인터셉터가
 *       (B) 로 이미 굳어 있으면 (B) 로 통일하고 이 파일 주석을 고치면 됩니다.
 */

/** 오류 본문. (A) 의 `error` 자리이며 관리자 오류 10종이 여기로 옵니다. */
export interface ApiErrorBody {
    code: string;
    message: string;
    /** 관리자 오류 10종은 전부 false 입니다 (API명세 B-5). */
    retryable: boolean;
    details?: Record<string, unknown>;
}

export interface ApiMeta {
    requestId?: string;
    timestamp?: string;
}

/** (A) 계약 봉투 */
export interface ContractSuccess<T> {
    success: true;
    data: T;
    meta?: ApiMeta;
}

export interface ContractFailure {
    success: false;
    error: ApiErrorBody;
    meta?: ApiMeta;
}

/** (B) 팀 컨벤션 봉투 */
export interface TeamEnvelope<T> {
    statusCode: number;
    timestamp?: string;
    path?: string;
    message?: string;
    data: T | null;
    error?: unknown;
}

export type ApiResponse<T> = ContractSuccess<T> | ContractFailure | TeamEnvelope<T>;

/**
 * 관리자 오류 코드 (API명세 B-5). 전부 `retryable=false` 라 자동 재시도하지 않습니다.
 *
 * 401 이 두 종류라는 게 중요합니다. 자격이 틀린 것과 세션이 끊긴 것은 화면 처리가 다릅니다.
 * 403 은 인증은 됐는데 역할이 `ADMIN` 이 아닌 경우라, "비밀번호가 틀렸다"고 하면 안 됩니다.
 */
export type AdminErrorCode =
    | 'INVALID_ADMIN_CREDENTIALS'
    | 'ADMIN_SESSION_EXPIRED'
    | 'ADMIN_ROLE_REQUIRED'
    | 'ADMIN_REASON_REQUIRED'
    | 'INSPECTION_ALREADY_DECIDED'
    | 'INVALID_INSPECTION_DECISION'
    | 'INVALID_SLOT_STATE_TRANSITION'
    | 'PHYSICAL_OCCUPANCY_MISMATCH'
    | 'SLOT_NOT_SAFE_FOR_AVAILABLE'
    | 'CONCURRENT_MODIFICATION';

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/**
 * 봉투를 벗겨 알맹이만 돌려줍니다. 규격을 안 따르는 응답은 원본 그대로 둡니다.
 *
 * (A) 는 `success` 로, (B) 는 `statusCode` 로 알아봅니다. 둘 다 아니면 손대지 않습니다 —
 * 백엔드가 봉투 없이 DTO 를 바로 주는 엔드포인트가 있어도 깨지지 않게.
 */
export function unwrapEnvelope<T>(body: unknown): T {
    if (!isObject(body) || !('data' in body)) return body as T;
    if ('success' in body || 'statusCode' in body) return body.data as T;
    return body as T;
}

/** 오류 본문에서 `code`·`message` 를 꺼냅니다. 어느 봉투든 같은 결과를 냅니다. */
export function readApiError(body: unknown): { code?: string; message?: string } {
    if (!isObject(body)) return {};

    const topMessage = typeof body.message === 'string' ? body.message : undefined;

    // (A) — error 가 코드·메시지를 가진 객체입니다.
    if (isObject(body.error)) {
        const { code, message } = body.error;
        return {
            code: typeof code === 'string' ? code : undefined,
            // error 안에 문구가 없으면 최상위 message 로 내려갑니다. (B) 가 error 를
            // 코드 없는 객체로 주는 경우가 있어서, 없으면 문구까지 통째로 잃습니다.
            message: typeof message === 'string' ? message : topMessage,
        };
    }

    // (B) — 최상위 message 만 있고 code 는 error 에 문자열로 오거나 아예 없습니다.
    return {
        code: typeof body.error === 'string' ? body.error : undefined,
        message: topMessage,
    };
}

/**
 * 커서 기반 목록 응답.
 *
 * 관리자 목록 API 는 `items` + `nextCursor` 입니다. cursor 는 불투명 문자열이라
 * 클라이언트가 해석하지 않고, 총 건수·총 페이지 수는 응답에 없습니다.
 */
export interface CursorPage<T> {
    items: T[];
    nextCursor: string | null;
}
