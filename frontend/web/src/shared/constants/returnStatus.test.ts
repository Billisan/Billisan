import { describe, expect, it } from 'vitest';

import {
    RETURN_STATUS_LABEL,
    RETURN_STATUS_TONE,
    type ReturnAttemptStatus,
} from '@/shared/constants/returnStatus';

/**
 * 반납 시도 상태 라벨.
 *
 * **실 응답을 그리는 값입니다** — 슬롯 상세의 `latestReturnAttempt.status`.
 * `features/history` 를 지우면서 여기로 옮겨 왔고, 그 폴더의 테스트도 같이 사라져서
 * 다시 붙입니다. 라벨이 하나라도 비면 슬롯 상세 배지가 빈칸으로 그려집니다.
 */

/** 백엔드 `ReturnAttempt.Status` 열거형 전체. 서버 소스에서 옮겨 적은 값입니다. */
const SERVER_VALUES: ReturnAttemptStatus[] = [
    'PROCESSING',
    'PHYSICAL_DONE',
    'COMPLETED',
    'RECOVERY_REQUIRED',
    'FAILED',
];

describe('반납 상태 — 서버가 보내는 값을 전부 그릴 수 있다', () => {
    it('다섯 값 모두 한글 라벨이 있다', () => {
        for (const status of SERVER_VALUES) {
            expect(RETURN_STATUS_LABEL[status], status).toBeTruthy();
        }
    });

    it('다섯 값 모두 배지 톤이 있다', () => {
        // 톤이 없으면 배지가 색 없이 그려집니다 — 실 API 에서만 드러나는 종류입니다.
        for (const status of SERVER_VALUES) {
            expect(RETURN_STATUS_TONE[status], status).toBeTruthy();
        }
    });

    it('서버에 없는 값을 임의로 들고 있지 않다', () => {
        /*
         * 예전에 `REVIEW_PENDING`·`REVIEW_DONE` 이 섞여 있었습니다. 그건 반납 상태가 아니라
         * 검수 처리 상태(`ReviewStatus`)라, 한 칸에 두 축이 들어가 「반납은 끝났고 검수만
         * 남았다」와 「반납 자체가 안 끝났다」를 구분할 수 없었습니다.
         */
        expect(Object.keys(RETURN_STATUS_LABEL).sort()).toEqual([...SERVER_VALUES].sort());
        expect(Object.keys(RETURN_STATUS_TONE).sort()).toEqual([...SERVER_VALUES].sort());
    });

    it('완료와 실패가 색으로 갈린다', () => {
        // 훑을 때 색으로 먼저 걸려야 하는 축입니다.
        expect(RETURN_STATUS_TONE.COMPLETED).toBe('green');
        expect(RETURN_STATUS_TONE.FAILED).toBe('red');
        expect(RETURN_STATUS_TONE.RECOVERY_REQUIRED).toBe('red');
    });
});
