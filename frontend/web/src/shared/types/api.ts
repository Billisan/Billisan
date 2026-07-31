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
 * 403 은 **관리자 계정이 아닌 주체**가 부른 경우라, "비밀번호가 틀렸다"고 하면 안 됩니다.
 *
 * `ADMIN_ROLE_REQUIRED` → `ADMIN_ACCOUNT_REQUIRED` 로 바뀌었습니다. 계약 DB v3.0 의
 * `ADMIN-AUTH-001` 이 "관리자는 별도 `ADMIN_ACCOUNT` 에서 인증한다. User 채널 토큰 또는
 * 관리자 계정·세션이 아닌 주체는 `403 ADMIN_ACCOUNT_REQUIRED`" 로 고쳤습니다. 역할
 * 컬럼을 보는 게 아니라 **계정·인증 채널 자체**가 다르다는 뜻입니다.
 */
export type AdminErrorCode =
    | 'INVALID_ADMIN_CREDENTIALS'
    | 'ADMIN_SESSION_EXPIRED'
    | 'ADMIN_ACCOUNT_REQUIRED'
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
 * 봉투 곁에 올 수 있는 메타 필드들. 이 이름들만 있으면 봉투로 봅니다.
 *
 * 업무 DTO 가 우연히 `data` 를 갖고 있을 때 잘못 벗기는 걸 막는 장치입니다. 관리자 API
 * 10개 중 최상위 `data` 를 쓰는 DTO 는 없지만, `unwrapEnvelope` 는 모든 응답을 지나므로
 * 조건을 좁혀 둡니다.
 */
const ENVELOPE_SIBLINGS = new Set([
    'success',
    'status',
    'statusCode',
    'code',
    'message',
    'error',
    'errors',
    'meta',
    'timestamp',
    'path',
    'requestId',
]);

/**
 * 봉투를 벗겨 알맹이만 돌려줍니다. 규격을 안 따르는 응답은 원본 그대로 둡니다.
 *
 * **`{ data: {...} }` 하나만 온 경우도 벗깁니다.** 계약이 응답을 「Body · `data`」로
 * 적어 두었을 뿐 `success` 나 `statusCode` 같은 동반 필드를 요구하지 않습니다. 예전에는
 * 그 둘 중 하나가 있어야만 벗겼는데, 서버가 계약 문구 그대로 `{"data":{…}}` 를 주면
 * **봉투째 통과시켜 알맹이를 못 읽었습니다.**
 *
 * 그게 조용한 고장이라 위험했습니다. `ADMIN-AUTH-001` 에서 `accessToken` 과 관리자
 * 신원이 전부 `undefined` 가 되는데도 로그인 화면은 대시보드로 넘어갑니다. 이후 모든
 * 요청에 `Authorization` 이 빠진 채 나가고, 사용자는 "로그인은 됐는데 아무것도 안 보인다"
 * 를 겪습니다. 실패로 보이지 않는 실패입니다.
 *
 * 판정은 "`data` 가 있고, 나머지 키가 전부 봉투용 메타인가"로 합니다. 그래서
 * `{data}`·`{success,data}`·`{statusCode,data}` 는 벗기고, `data` 옆에 업무 필드가
 * 있는 응답은 손대지 않습니다.
 */
export function unwrapEnvelope<T>(body: unknown): T {
    if (!isObject(body) || !('data' in body)) return body as T;

    const siblings = Object.keys(body).filter((key) => key !== 'data');
    if (siblings.every((key) => ENVELOPE_SIBLINGS.has(key))) return body.data as T;

    return body as T;
}

/**
 * 오류 본문에서 `code`·`message` 를 꺼냅니다. 어느 봉투든 같은 결과를 냅니다.
 *
 * **계약이 오류 본문의 모양을 정해 두지 않았습니다.** `ADMIN-AUTH-001` 은 성공 응답만
 * `data` 봉투로 규정하고, 실패는 `401 INVALID_ADMIN_CREDENTIALS`·`403
 * ADMIN_ACCOUNT_REQUIRED` 라는 코드 이름만 적혀 있습니다. 그래서 서버가 셋 중 무엇을
 * 주더라도 같은 값을 읽도록 셋 다 받습니다.
 *
 * 코드를 못 읽으면 화면이 401 과 403 을 구분하지 못합니다. 「비밀번호가 틀렸다」와
 * 「관리자 계정이 아니다」는 사용자가 해야 할 행동이 전혀 달라서, 그걸 뭉뚱그리면
 * 관리자 권한이 없는 사람이 비밀번호만 계속 다시 칩니다.
 */
export function readApiError(body: unknown): { code?: string; message?: string } {
    if (!isObject(body)) return {};

    const topMessage = typeof body.message === 'string' ? body.message : undefined;
    /** (C) — 코드가 최상위에 평평하게 옵니다. 아래 두 모양이 못 잡을 때의 마지막 수단입니다. */
    const topCode = typeof body.code === 'string' ? body.code : undefined;

    // (A) — error 가 코드·메시지를 가진 객체입니다.
    if (isObject(body.error)) {
        const { code, message } = body.error;
        return {
            code: typeof code === 'string' ? code : topCode,
            // error 안에 문구가 없으면 최상위 message 로 내려갑니다. (B) 가 error 를
            // 코드 없는 객체로 주는 경우가 있어서, 없으면 문구까지 통째로 잃습니다.
            message: typeof message === 'string' ? message : topMessage,
        };
    }

    // (B) — 최상위 message 만 있고 code 는 error 에 문자열로 오거나 아예 없습니다.
    return {
        code: typeof body.error === 'string' ? body.error : topCode,
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
