import { errorCodeOf } from '@/lib/api-error';

/**
 * 관리자 쓰기 요청 실패 → 관리자가 읽을 안내.
 *
 * **근거는 백엔드 `GlobalExceptionHandler` 입니다.** 스웨거에는 오류 응답이 하나도
 * 선언돼 있지 않습니다 — 전 경로가 `200` 하나뿐이라 스펙만 보면 이 API 는 실패하지
 * 않는 것처럼 보입니다. 그래서 예전에는 실연동에서 **직접 겪은 코드만** 처리돼
 * 있었고, 나머지는 서버 메시지에 코드를 괄호로 붙여 그대로 노출했습니다.
 * `판정을 저장하지 못했습니다 (INVALID_SLOT_STATUS_COMBINATION)` 같은 식인데,
 * 관리자가 그 문자열로 할 수 있는 게 없습니다.
 *
 * 안내 문구를 고를 때 기준은 **「관리자가 지금 뭘 해야 하나」** 하나입니다.
 *   다시 눌러도 되나 / 새로고침해야 하나 / 사람에게 알려야 하나
 *
 * TODO: 스펙에 오류 응답이 들어오면 그쪽을 근거로 삼고 이 표를 대조하세요.
 */

export interface AdminErrorMessage {
    title: string;
    detail: string;
}

/** 개발팀이 봐야 하는 오류 — 관리자가 다시 눌러도 소용없습니다. */
const REPORT_TO_DEV = '화면 오류일 수 있습니다. 다시 시도하지 마시고 개발팀에 알려 주세요.';

/**
 * 두 화면(슬롯 상태 변경 · 검수 판정)이 공유하는 오류.
 *
 * 화면마다 다른 것은 각자 처리하고, 여기서는 **어느 쓰기 요청에서든 같은 뜻인 것**만
 * 다룹니다.
 */
export function commonAdminErrorOf(error: unknown): AdminErrorMessage | null {
    switch (errorCodeOf(error)) {
        /*
         * 400 — **우리 화면이 계약을 어겼다는 신호입니다.**
         * 잘못된 4축 조합, 필수 헤더·파라미터 누락, 본문 파싱 실패, enum 밖의 값.
         * 정상 사용으로는 날 수 없으므로 재시도를 권하면 안 됩니다.
         */
        case 'INVALID_SLOT_STATUS_COMBINATION':
            return { title: '허용되지 않는 상태 조합입니다', detail: REPORT_TO_DEV };
        case 'INVALID_REQUEST':
            return { title: '요청 형식이 올바르지 않습니다', detail: REPORT_TO_DEV };

        /*
         * 422 — 사유가 비었습니다. **관리자가 그 자리에서 고칠 수 있는 유일한 오류**라
         * 문구도 재시도를 권하는 쪽입니다.
         *
         * 두 화면 모두 서버가 던집니다 — `SlotAdminService.updateStatus` 와
         * `InspectionAdminService` 가 각각 `AdminReasonRequiredException` 을 냅니다.
         * 예전에는 검수 판정에만 처리가 있어서, 슬롯 상태 변경에서 나면 서버 원문인
         * `reasonCode는 필수입니다.` 가 그대로 노출됐습니다. 필드 이름은 관리자에게
         * 정보가 아닙니다.
         *
         * 두 다이얼로그가 빈 사유를 막고 있어(`canSubmit`) 정상 사용으로는 안 나지만,
         * 그 방어가 사라지면 조용히 영문 필드명이 새는 자리라 여기서 받습니다.
         */
        case 'ADMIN_REASON_REQUIRED':
            return {
                title: '사유 코드가 필요합니다',
                detail: '사유를 입력한 뒤 다시 저장해 주세요.',
            };

        /* 404 — 화면 목록이 낡았습니다. 새로고침이 실제 해결책입니다. */
        case 'SLOT_NOT_FOUND':
        case 'STATION_NOT_FOUND':
        case 'INSPECTION_NOT_FOUND':
        case 'NOT_FOUND':
            return {
                title: '대상을 찾을 수 없습니다',
                detail: '목록이 오래되었을 수 있습니다. 새로고침 후 다시 확인해 주세요.',
            };

        /*
         * 401 — 토큰이 없거나 만료됐습니다.
         *
         * **이 코드는 `GlobalExceptionHandler` 에 없습니다.** 시큐리티 계층이
         * (`JwtAuthenticationEntryPoint`) 필터에서 직접 응답을 씁니다. 예외 핸들러만
         * 훑었을 때 놓쳤던 자리입니다.
         *
         * 관리자 웹은 토큰을 메모리에만 두므로(브라우저 영속 저장 금지 · 12-R B-2)
         * **새로고침하면 곧바로 이 오류**입니다. 유휴 30분·절대 8시간 만료로도 납니다.
         * 실연동에서 가장 자주 보게 될 오류라 문구가 분명해야 합니다.
         */
        case 'UNAUTHORIZED':
            return {
                title: '로그인이 필요합니다',
                detail: '세션이 만료되었습니다. 다시 로그인한 뒤 진행해 주세요.',
            };

        /*
         * 403 — 인증은 됐는데 관리자가 아닙니다. 시큐리티가 `hasRole("ADMIN")` 으로
         * 막습니다(`JwtAccessDeniedHandler`). 다시 눌러도 소용없습니다.
         */
        case 'ADMIN_ACCOUNT_REQUIRED':
            return {
                title: '권한이 없습니다',
                detail: '관리자 계정으로 로그인했는지 확인해 주세요.',
            };
        case 'INVALID_ADMIN_CREDENTIALS':
            return { title: '로그인이 필요합니다', detail: '다시 로그인한 뒤 진행해 주세요.' };

        default:
            return null;
    }
}

/**
 * 어느 분기에도 안 걸린 오류의 마지막 문구.
 *
 * 서버 메시지가 있으면 그대로 씁니다 — 500 의 「일시적인 오류가 발생했습니다.」처럼
 * 서버 쪽이 더 정확합니다. 응답이 아예 없는 경우(연결 실패·타임아웃)는 axios
 * 인터셉터가 이미 한글로 바꿔 두어 영문이 새지 않습니다.
 *
 * **오류 코드를 화면에 붙이지 않습니다.** 관리자에게 `(INTERNAL_SERVER_ERROR)` 는
 * 정보가 아니라 소음입니다. 개발자가 필요하면 콘솔·네트워크 탭에서 봅니다.
 */
export function fallbackAdminErrorOf(error: unknown, title: string): AdminErrorMessage {
    const message = error instanceof Error ? error.message : '';
    return { title, detail: message || '잠시 후 다시 시도해 주세요.' };
}
