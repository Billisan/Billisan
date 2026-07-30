import { describe, expect, it } from 'vitest';

import { MOCK_STATIONS, findStation } from '@/features/stations/mocks/stations';
import { buildSlots } from '@/features/stations/mocks/slots';
import { deriveSlotDisplayStatus } from '@/features/stations/types';

/**
 * 대여소 목록의 신원과 검색.
 *
 * ERD v3.0 은 `STATION` 의 PK 를 `station_id CHAR(36)` UUID 로 정하고, 그것이
 * "MQTT Topic·장치 설정·인터페이스 상관의 권위 식별자" 라고 못 박았습니다.
 * `station_code`·`location_text` 는 P0 필수 컬럼이 아니라 화면이 기대면 안 됩니다.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 목록 화면과 같은 규칙. 여기서 어긋나면 화면도 어긋납니다. */
function search(keyword: string) {
    const q = keyword.trim().toLowerCase();
    if (!q) return MOCK_STATIONS;
    return MOCK_STATIONS.filter(
        (station) =>
            station.name.toLowerCase().includes(q) || station.stationId.toLowerCase().startsWith(q),
    );
}

describe('대여소 신원', () => {
    it('stationId 가 UUID 형식이다', () => {
        for (const station of MOCK_STATIONS) {
            expect(station.stationId, station.name).toMatch(UUID);
        }
    });

    it('stationId 가 서로 겹치지 않는다', () => {
        const ids = new Set(MOCK_STATIONS.map((s) => s.stationId));
        expect(ids.size).toBe(MOCK_STATIONS.length);
    });

    it('name 이 비어 있지 않다 — NOT NULL 이라 표시는 항상 이걸로 한다', () => {
        for (const station of MOCK_STATIONS) {
            expect(station.name.trim().length).toBeGreaterThan(0);
        }
    });

    it('P0 필수가 아닌 컬럼을 들고 있지 않다', () => {
        // ERD v3.0 DEC-047: station_code·location_text 를 P0 필수 컬럼으로 두지 않는다.
        for (const station of MOCK_STATIONS) {
            expect(station).not.toHaveProperty('stationCode');
            expect(station).not.toHaveProperty('locationText');
        }
    });
});

describe('대여소 검색', () => {
    it('이름으로 찾는다', () => {
        const target = MOCK_STATIONS[0];
        expect(search(target.name).map((s) => s.stationId)).toContain(target.stationId);
    });

    it('UUID 앞자리로 찾는다 — 로그에서 가져온 값을 붙여 넣는 경우', () => {
        /*
         * 36자를 외워서 치는 사람은 없습니다. 반대 방향이 실제 상황입니다 —
         * 백엔드 로그에 찍힌 `de9ef0ce-…` 가 어느 대여소인지 알아내야 할 때.
         * 화면 표시가 앞 8자 축약이라 그만큼만 붙여 넣어도 걸려야 합니다.
         */
        const target = MOCK_STATIONS[0];
        const head = target.stationId.slice(0, 8);
        const hit = search(head);
        expect(hit).toHaveLength(1);
        expect(hit[0].stationId).toBe(target.stationId);
    });

    it('UUID 전체를 붙여 넣어도 찾는다', () => {
        const target = MOCK_STATIONS[2];
        expect(search(target.stationId)).toEqual([target]);
    });

    it('대소문자를 가리지 않는다', () => {
        const target = MOCK_STATIONS[1];
        expect(search(target.stationId.slice(0, 8).toUpperCase())).toEqual([target]);
    });
});

describe('findStation', () => {
    it('UUID 로 찾고, 없는 값이면 undefined', () => {
        expect(findStation(MOCK_STATIONS[0].stationId)?.name).toBe(MOCK_STATIONS[0].name);
        expect(findStation('00000000-0000-4000-8000-000000000000')).toBeUndefined();
        expect(findStation(undefined)).toBeUndefined();
    });
});

describe('대여소 집계', () => {
    it('capacity 가 실제 슬롯 수와 같다', () => {
        // 목록의 분모입니다. ADMIN-INVENTORY-001 의 totalSlotCount 에 대응합니다.
        for (const station of MOCK_STATIONS) {
            expect(station.capacity, station.name).toBe(buildSlots(station).length);
            expect(station.capacity, station.name).toBe(station.slotCount);
        }
    });

    it('available·damaged·adminReview 가 슬롯 표시 상태를 그대로 센 값이다', () => {
        /*
         * 집계와 표가 어긋나면 관리자가 어느 쪽을 믿어야 할지 모릅니다. 목록의
         * `사용 가능 3` 과 대여소 상세에서 초록 배지 3개가 반드시 같아야 합니다.
         */
        for (const station of MOCK_STATIONS) {
            const display = buildSlots(station).map(deriveSlotDisplayStatus);
            expect(station.available, `${station.name} 사용 가능`).toBe(
                display.filter((d) => d === 'AVAILABLE').length,
            );
            expect(station.damaged, `${station.name} 파손`).toBe(
                display.filter((d) => d === 'DAMAGED').length,
            );
            expect(station.adminReview, `${station.name} 관리자 확인`).toBe(
                display.filter((d) => d === 'ADMIN_REVIEW').length,
            );
        }
    });

    it('사용 가능 수가 전체 슬롯 수를 넘지 않는다', () => {
        for (const station of MOCK_STATIONS) {
            expect(station.available, station.name).toBeLessThanOrEqual(station.capacity);
            expect(station.available).toBeGreaterThanOrEqual(0);
        }
    });

    it('전체 합계가 대여소별 합과 같다', () => {
        // 목록 하단 요약이 쓰는 계산입니다.
        const total = MOCK_STATIONS.reduce(
            (acc, s) => ({
                available: acc.available + s.available,
                capacity: acc.capacity + s.capacity,
            }),
            { available: 0, capacity: 0 },
        );
        expect(total.capacity).toBe(MOCK_STATIONS.reduce((n, s) => n + s.slotCount, 0));
        expect(total.available).toBeLessThanOrEqual(total.capacity);
    });
});
