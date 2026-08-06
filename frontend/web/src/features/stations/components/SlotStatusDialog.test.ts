import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 슬롯 상태 변경 다이얼로그가 **서버가 거부할 조합을 보내지 못하게** 잠급니다.
 *
 * 서버는 `Slot.isValidAdminCombination` 으로 4축 조합을 검사하고, 어긋나면
 * `400 INVALID_SLOT_STATUS_COMBINATION` 입니다. 그런데 **스웨거에는 그 규칙이
 * 없습니다** — 요청 스키마에 두 enum 이 따로 있을 뿐 어떤 짝이 되는지는 안 적혀
 * 있고, 오류 응답도 선언돼 있지 않습니다(전 경로 200 만).
 *
 * 그래서 목업으로도 스펙 대조로도 안 잡힙니다. 선택지를 하나 더 넣는 순간
 * **실 API 에서만** 터지고, 그때는 "왜 저장이 안 되지" 로 한참 헤맵니다.
 * 규칙을 여기 옮겨 적어 두고 코드가 벗어나면 걸리게 합니다.
 *
 * 근거: `backend/src/main/java/dev/billisan/slot/domain/Slot.java`
 *       `isValidAdminCombination` (주석에 `docs/API-draft.md §8.2` 인용)
 * TODO: 스펙이 허용 조합을 표현하게 되면 그쪽에서 읽어 오세요.
 */

/** 서버가 허용하는 (serviceStatus → itemCondition[]) — Slot.java 를 그대로 옮긴 것. */
const ALLOWED: Record<string, string[]> = {
    AVAILABLE: ['EMPTY', 'NORMAL'],
    ADMIN_REVIEW: ['UNKNOWN', 'DAMAGED', 'REPAIRABLE'],
    OUT_OF_SERVICE: ['DAMAGED', 'REPAIRABLE', 'EMPTY'],
};

const source = readFileSync(
    resolve(process.cwd(), 'src/features/stations/components/SlotStatusDialog.tsx'),
    'utf8',
);

/** 라디오 선택지가 담고 있는 (서비스, 품질) 짝. */
function optionPairs(): Array<[string, string]> {
    return [...source.matchAll(/serviceStatus: '(\w+)',\s*\n\s*itemCondition: '(\w+)',/g)].map(
        (m) => [m[1], m[2]],
    );
}

/** 「수리 가능」 하위 선택이 덮어쓰는 품질 값. */
function repairableOverride(): string | null {
    const m = source.match(/repairableOn\s*\n?\s*\?\s*'(\w+)'/);
    return m ? m[1] : null;
}

describe('상태 변경 다이얼로그 — 서버가 받는 조합만 보낸다', () => {
    it('선택지를 하나 이상 찾았다', () => {
        // 정규식이 코드 변경으로 헛돌면 아래 검사가 통째로 무의미해집니다.
        expect(optionPairs().length).toBeGreaterThan(0);
    });

    it('모든 라디오 선택지가 서버 허용 조합이다', () => {
        for (const [service, item] of optionPairs()) {
            expect(ALLOWED[service], `허용되지 않는 서비스 상태: ${service}`).toBeDefined();
            expect(ALLOWED[service], `${service} + ${item}`).toContain(item);
        }
    });

    it('「수리 가능」 하위 선택도 허용 조합이다', () => {
        /*
         * 이 체크박스는 `ADMIN_REVIEW` 를 고른 동안에만 나오고 품질을 `REPAIRABLE` 로
         * 덮어씁니다. 서버가 `ADMIN_REVIEW + REPAIRABLE` 을 허용하므로 성립합니다.
         * 덮어쓰는 값이나 붙는 자리가 바뀌면 여기서 걸립니다.
         */
        const override = repairableOverride();
        expect(override, '수리 가능 하위 선택의 값을 찾지 못했습니다').not.toBeNull();
        expect(ALLOWED.ADMIN_REVIEW).toContain(override);
    });

    it('서버 허용 조합 자체가 바뀌지 않았다', () => {
        /*
         * 백엔드가 조합 규칙을 바꾸면 이 표가 낡습니다. 값을 박아 두었다는 사실을
         * 테스트 이름으로 드러내, 실 API 에서 400 이 날 때 여기부터 보게 합니다.
         */
        expect(Object.keys(ALLOWED).sort()).toEqual([
            'ADMIN_REVIEW',
            'AVAILABLE',
            'OUT_OF_SERVICE',
        ]);
    });
});
