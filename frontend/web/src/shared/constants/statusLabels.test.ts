import { describe, expect, it } from 'vitest';

import {
    AI_RESULT_LABEL,
    DECISION_LABEL,
    DEVICE_STATUS_LABEL,
    ITEM_CONDITION_LABEL,
    LOCK_STATUS_LABEL,
    REVIEW_STATUS_LABEL,
    SLOT_DISPLAY_LABEL,
    SLOT_SERVICE_LABEL,
    STATION_SERVICE_LABEL,
    codeHint,
} from '@/shared/constants/statusLabels';

/**
 * 상태 라벨 사전.
 *
 * ERD §2.4.1 이 정한 두 문장을 지키는지 봅니다.
 *   "관리자 웹의 배지, 표, 상세 화면, 안내 문구는 **한글 명칭 우선**으로 표시한다."
 *   "**API·DB·로그 값을 화면에 직접 노출하지 않고** 프론트엔드의 공통 상태 라벨 매핑을
 *    통해 변환한다."
 *
 * 이 규칙을 실제로 네 번 어겼습니다 — 반납 상세의 `FAILED`, 검수 상세의
 * `AVAILABLE + NORMAL`, 정산 상세의 `DAMAGED`, 안내 문장의 `PAID`. 전부 화면에 코드가
 * 그대로 나갔습니다. 사전이 비어 있어서가 아니라 **사전을 안 거치고** 값을 찍어서였습니다.
 * 사전 자체가 오염되는 걸 여기서 막습니다.
 */

/** 화면에 나가는 사전 전부. 새 사전을 추가하면 여기에도 넣으세요. */
const SCREEN_LABELS = {
    STATION_SERVICE_LABEL,
    SLOT_SERVICE_LABEL,
    ITEM_CONDITION_LABEL,
    AI_RESULT_LABEL,
    DECISION_LABEL,
    SLOT_DISPLAY_LABEL,
    REVIEW_STATUS_LABEL,
    LOCK_STATUS_LABEL,
} as const;

describe('라벨 사전에 코드 원문이 없다', () => {
    it('모든 표시값이 한글을 담고 있다', () => {
        for (const [dictName, dict] of Object.entries(SCREEN_LABELS)) {
            for (const [code, label] of Object.entries(dict)) {
                expect(label, `${dictName}.${code}`).toMatch(/[가-힣]/);
            }
        }
    });

    it('표시값이 자기 코드를 그대로 되풀이하지 않는다', () => {
        for (const [dictName, dict] of Object.entries(SCREEN_LABELS)) {
            for (const [code, label] of Object.entries(dict)) {
                expect(label, `${dictName}.${code}`).not.toBe(code);
                // 'AVAILABLE + NORMAL' 처럼 코드를 문장에 섞어 둔 경우도 걸립니다.
                expect(label, `${dictName}.${code}`).not.toMatch(/[A-Z]{3,}/);
            }
        }
    });

    it('한 사전 안에서 같은 글자가 두 코드에 붙어 있지 않다', () => {
        /*
         * 같은 배지 글자가 두 상태를 가리키면 관리자가 화면만 보고 구분할 수 없습니다.
         * 사전이 다르면(이용 가능 = SLOT_SERVICE 와 SLOT_DISPLAY) 문맥이 달라 괜찮습니다.
         */
        for (const [dictName, dict] of Object.entries(SCREEN_LABELS)) {
            const labels = Object.values(dict);
            expect(new Set(labels).size, `${dictName} 중복 표시값`).toBe(labels.length);
        }
    });
});

describe('장치 연결 표시', () => {
    it('여기만 한글을 쓰지 않는다 — 열 제목이 이미 온라인이다', () => {
        // 도메인 업무 상태가 아니라 통신 여부라서, 표에서 신호등 역할을 합니다.
        expect(DEVICE_STATUS_LABEL).toEqual({ ONLINE: 'ON', OFFLINE: 'OFF', ERROR: 'ERR' });
    });

    it('오류를 오프라인과 합치지 않는다', () => {
        // 통신이 끊긴 것과 장치가 고장 난 것은 대응이 다릅니다.
        expect(DEVICE_STATUS_LABEL.ERROR).not.toBe(DEVICE_STATUS_LABEL.OFFLINE);
    });
});

describe('값 집합이 서로 섞이지 않는다', () => {
    it('AI 결과에는 슬롯 상태 값이 없다', () => {
        // 화면흐름 §17: AI 보조 결과와 슬롯 Enum 을 혼동하지 않는다.
        // 시안이 AI 결과 자리에 ADMIN_REVIEW 를 적어 놨는데 그건 슬롯 상태입니다.
        expect(Object.keys(AI_RESULT_LABEL)).toEqual(['NORMAL', 'DAMAGED', 'UNCERTAIN', 'FAILED']);
    });

    it('관리자 판정에는 판정 보류가 있고 슬롯 상태는 없다', () => {
        expect(Object.keys(DECISION_LABEL)).toEqual(['NORMAL', 'DAMAGED', 'KEEP_ADMIN_REVIEW']);
    });

    it('파생 슬롯 상태에 대여 중이 없다', () => {
        /*
         * 관리자 API 어디에도 활성 대여 연결이 없습니다. 우산이 나가 있는 슬롯은 서버
         * 기준으로도 빈 슬롯이라 '대여 중' 을 만들 근거가 없습니다 (12-R B-4).
         */
        expect(Object.keys(SLOT_DISPLAY_LABEL)).not.toContain('RENTED');
        expect(Object.values(SLOT_DISPLAY_LABEL)).not.toContain('대여 중');
    });

    it('AI 결과와 관리자 판정의 글자가 서로 구분된다', () => {
        // 둘 다 NORMAL·DAMAGED 코드를 갖습니다. 글자까지 같으면 화면에서
        // "AI 가 본 것" 과 "사람이 정한 것" 을 구분할 수 없습니다.
        expect(AI_RESULT_LABEL.NORMAL).not.toBe(DECISION_LABEL.NORMAL);
        expect(AI_RESULT_LABEL.DAMAGED).not.toBe(DECISION_LABEL.DAMAGED);
    });
});

describe('codeHint', () => {
    it('한글과 코드를 함께 낸다 — 마우스오버 전용이다', () => {
        // 화면 배지에는 한글만, 로그·백엔드 대조가 필요할 때만 코드를 붙입니다.
        expect(codeHint(SLOT_DISPLAY_LABEL, 'ADMIN_REVIEW')).toBe('관리자 확인 · ADMIN_REVIEW');
    });
});
