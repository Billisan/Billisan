import { describe, expect, it } from 'vitest';

import { MOCK_NS, mockSeq, mockUuid } from '@/features/stations/mocks/ids';

/**
 * 목업 식별자.
 *
 * **여기서 실제로 버그가 났습니다.** 목업이 예전에 UUID 꼬리를 숫자로 파싱했는데
 * (`Number(stationId.slice(-4))`), 값이 규칙적일 때만 통했습니다. 전 구간 무작위로
 * 바꾸는 순간 `NaN` 이 되어 모든 대여소가 같은 시드로 뭉개졌고, 여섯 대여소의 1번 슬롯이
 * 한 검수 ID 를 공유해 React 중복 key 경고가 났습니다.
 *
 * 목업 코드지만 이 함수는 지웁니다 — 실 API 연동 때 함께 사라집니다. 그때까지는
 * **화면이 서버가 줄 값과 같은 모양을 보고 있다**는 걸 이 테스트가 지킵니다.
 */

/** UUID v4 형식. 버전 자리는 4, variant 자리는 8~b 여야 합니다. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const NAMESPACES = Object.values(MOCK_NS);

describe('mockUuid', () => {
    it('모든 종류가 UUID v4 형식을 지킨다', () => {
        for (const ns of NAMESPACES) {
            for (const seq of [1, 2, 37, 999, 9999]) {
                expect(mockUuid(ns, seq)).toMatch(UUID_V4);
            }
        }
    });

    it('같은 입력은 늘 같은 값을 낸다 — 새로고침해도 링크가 살아 있어야 한다', () => {
        expect(mockUuid(MOCK_NS.station, 7)).toBe(mockUuid(MOCK_NS.station, 7));
    });

    it('seq 가 다르면 값이 다르다', () => {
        const ids = new Set(Array.from({ length: 500 }, (_, i) => mockUuid(MOCK_NS.slot, i + 1)));
        expect(ids.size).toBe(500);
    });

    it('종류가 다르면 같은 seq 라도 값이 다르다', () => {
        const ids = new Set(NAMESPACES.map((ns) => mockUuid(ns, 1)));
        expect(ids.size).toBe(NAMESPACES.length);
    });

    it('앞자리에 종류를 심지 않는다 — 축약 표기가 서로 구분돼야 한다', () => {
        /*
         * 예전에 `e0000000…` 처럼 종류별 접두사를 뒀더니, 화면흐름 §12 의 앞 8자 축약
         * 표기가 같은 종류끼리 전부 똑같이 보였습니다. 실제 UUID 는 전 구간 무작위입니다.
         */
        const heads = new Set(
            Array.from({ length: 40 }, (_, i) => mockUuid(MOCK_NS.rental, i + 1).slice(0, 8)),
        );
        expect(heads.size).toBe(40);
    });
});

describe('mockSeq', () => {
    it('UUID 를 넣어도 숫자가 나온다 — NaN 붕괴가 났던 지점', () => {
        for (const ns of NAMESPACES) {
            const seq = mockSeq(mockUuid(ns, 1));
            expect(Number.isInteger(seq)).toBe(true);
            expect(seq).toBeGreaterThanOrEqual(1);
            expect(seq).toBeLessThanOrEqual(9999);
        }
    });

    it('서로 다른 UUID 는 서로 다른 시드로 흩어진다', () => {
        /*
         * 대여소마다 슬롯 구성이 달라야 하는데, 시드가 뭉치면 모든 대여소가 같은 구성이
         * 되고 파생 ID 까지 충돌합니다. 완전 유일까지는 요구하지 않지만(해시 범위가
         * 9999 라 비둘기집으로 충돌이 납니다) 상수로 붕괴하지는 않아야 합니다.
         */
        const seeds = new Set(
            Array.from({ length: 30 }, (_, i) => mockSeq(mockUuid(MOCK_NS.station, i + 1))),
        );
        expect(seeds.size).toBeGreaterThan(25);
    });

    it('같은 입력은 늘 같은 시드를 낸다', () => {
        expect(mockSeq('제1공학관')).toBe(mockSeq('제1공학관'));
    });
});
