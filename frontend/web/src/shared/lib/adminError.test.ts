import { describe, expect, it } from 'vitest';

import { ApiRequestError } from '@/lib/api-error';
import { commonAdminErrorOf, fallbackAdminErrorOf } from '@/shared/lib/adminError';

/**
 * 관리자 쓰기 요청 실패 안내.
 *
 * **스웨거에 오류 응답이 하나도 없습니다** — 전 경로가 `200` 하나뿐입니다. 그래서
 * 예전에는 실연동에서 직접 겪은 코드만 처리돼 있었고, 나머지는 서버 메시지에 코드를
 * 괄호로 붙여 그대로 노출했습니다. 관리자에게 `(INVALID_SLOT_STATUS_COMBINATION)` 은
 * 정보가 아닙니다.
 *
 * 코드 목록의 근거는 백엔드 `GlobalExceptionHandler` 입니다.
 */

function withCode(code: string) {
    return new ApiRequestError({ message: '서버 원문 메시지', statusCode: 400, code });
}

describe('공통 오류 — 관리자가 할 일이 문구에 드러난다', () => {
    it('400 계열은 재시도를 권하지 않는다', () => {
        /*
         * 우리 화면이 계약을 어겼다는 신호라 눌러도 계속 실패합니다.
         * 「다시 시도」로 안내하면 관리자가 무한히 누릅니다.
         */
        for (const code of ['INVALID_SLOT_STATUS_COMBINATION', 'INVALID_REQUEST']) {
            const message = commonAdminErrorOf(withCode(code));
            expect(message, code).not.toBeNull();
            expect(message!.detail, code).toContain('개발팀에 알려');
            expect(message!.detail, code).toContain('다시 시도하지');
        }
    });

    it('404 계열은 새로고침을 안내한다', () => {
        for (const code of [
            'SLOT_NOT_FOUND',
            'STATION_NOT_FOUND',
            'INSPECTION_NOT_FOUND',
            'NOT_FOUND',
        ]) {
            const message = commonAdminErrorOf(withCode(code));
            expect(message, code).not.toBeNull();
            expect(message!.detail, code).toContain('새로고침');
        }
    });

    it('권한 오류는 로그인을 안내한다', () => {
        for (const code of ['ADMIN_ACCOUNT_REQUIRED', 'INVALID_ADMIN_CREDENTIALS']) {
            expect(commonAdminErrorOf(withCode(code))?.detail, code).toContain('로그인');
        }
    });

    it('UNAUTHORIZED 를 세션 만료로 안내한다', () => {
        /*
         * **이 코드는 `GlobalExceptionHandler` 에 없습니다.** 시큐리티 필터
         * (`JwtAuthenticationEntryPoint`)가 직접 응답을 써서, 예외 핸들러만 훑었을 때
         * 놓쳤던 자리입니다.
         *
         * 관리자 웹은 토큰을 메모리에만 두므로 **새로고침하면 곧바로 이 오류**입니다.
         * 실연동에서 가장 자주 보게 될 오류라 문구가 분명해야 합니다.
         */
        const message = commonAdminErrorOf(withCode('UNAUTHORIZED'));
        expect(message).not.toBeNull();
        expect(message!.detail).toContain('세션이 만료');
        expect(message!.detail).toContain('로그인');
    });

    it('사유 누락(422)은 두 화면 모두에서 같은 문구다', () => {
        /*
         * 서버는 슬롯 상태 변경(`SlotAdminService.updateStatus`)과 검수 판정 양쪽에서
         * `AdminReasonRequiredException` 을 던집니다. 예전에는 검수 쪽에만 처리가 있어
         * 슬롯에서 나면 서버 원문 `reasonCode는 필수입니다.` 가 그대로 노출됐습니다.
         *
         * 관리자가 그 자리에서 고칠 수 있는 유일한 오류라, 여기만 재시도를 권합니다.
         */
        const message = commonAdminErrorOf(withCode('ADMIN_REASON_REQUIRED'));
        expect(message).not.toBeNull();
        expect(message!.detail).toContain('사유');
        expect(message!.detail).toContain('다시 저장');
        expect(message!.detail).not.toContain('reasonCode');
    });

    it('모르는 코드는 null 이다 — 화면이 자기 문구를 쓰게 둡니다', () => {
        expect(commonAdminErrorOf(withCode('SOMETHING_NEW'))).toBeNull();
        expect(commonAdminErrorOf(new Error('코드 없음'))).toBeNull();
    });
});

describe('마지막 문구', () => {
    it('서버 메시지가 있으면 그대로 쓴다', () => {
        // 500 의 「일시적인 오류가 발생했습니다.」처럼 서버 쪽이 더 정확합니다.
        const message = fallbackAdminErrorOf(
            new ApiRequestError({ message: '일시적인 오류가 발생했습니다.', statusCode: 500 }),
            '저장하지 못했습니다',
        );
        expect(message.detail).toBe('일시적인 오류가 발생했습니다.');
    });

    it('서버 메시지가 없으면 한글 안내로 채운다', () => {
        expect(fallbackAdminErrorOf({}, '저장하지 못했습니다').detail).toBe(
            '잠시 후 다시 시도해 주세요.',
        );
    });
});

describe('오류 코드가 화면에 노출되지 않는다', () => {
    it('안내 문구 어디에도 대문자 코드가 섞이지 않는다', () => {
        /*
         * 회귀 테스트. 예전에는 `${error.message} (${code})` 로 붙여 내보냈습니다.
         * 개발자가 코드를 봐야 하면 콘솔·네트워크 탭에서 봅니다 — 관리자 화면은 아닙니다.
         */
        const codes = [
            'INVALID_SLOT_STATUS_COMBINATION',
            'INVALID_REQUEST',
            'SLOT_NOT_FOUND',
            'STATION_NOT_FOUND',
            'INSPECTION_NOT_FOUND',
            'ADMIN_ACCOUNT_REQUIRED',
            'INVALID_ADMIN_CREDENTIALS',
            'UNAUTHORIZED',
            'ADMIN_REASON_REQUIRED',
        ];
        for (const code of codes) {
            const message = commonAdminErrorOf(withCode(code))!;
            const text = `${message.title} ${message.detail}`;
            expect(text, code).not.toMatch(/[A-Z]{2,}_[A-Z_]+/);
        }
    });
});
