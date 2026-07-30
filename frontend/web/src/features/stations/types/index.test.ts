import { describe, expect, it } from 'vitest';

import {
    deriveSlotDisplayStatus,
    formatSlotLabel,
    formatUpdatedAt,
    getStationStatus,
    isDeviceOnline,
    sortByStock,
    STOCK_THRESHOLD,
    type SlotSummary,
    type Station,
} from '@/features/stations/types';

/**
 * 슬롯·대여소 파생 함수.
 *
 * 이 함수들이 계약 문장을 코드로 옮긴 자리입니다. 표현이 맞는지는 화면을 봐야 알지만,
 * **어떤 4축 조합이 어떤 표시가 되는지**는 여기서 못 박아 둘 수 있습니다.
 */

/** 4축을 다 채운 기본 슬롯. 테스트마다 필요한 축만 덮어씁니다. */
function slot(overrides: Partial<SlotSummary> = {}): SlotSummary {
    return {
        slotId: 'slot-1',
        slotNumber: 1,
        occupancyStatus: 'OCCUPIED',
        itemCondition: 'NORMAL',
        serviceStatus: 'AVAILABLE',
        lockStatus: 'LOCKED',
        updatedAt: '2026-07-24 09:20:11.123456',
        ...overrides,
    };
}

function station(overrides: Partial<Station> = {}): Station {
    return {
        stationId: 'station-1',
        name: '제1공학관',
        serviceStatus: 'AVAILABLE',
        deviceStatus: 'ONLINE',
        slotCount: 5,
        available: 3,
        capacity: 5,
        damaged: 0,
        adminReview: 0,
        position: { x: 50, y: 50 },
        ...overrides,
    };
}

describe('deriveSlotDisplayStatus', () => {
    it('대여 가능 조건은 4축이 전부 맞을 때만이다', () => {
        // ERD SLOT 불변조건: AVAILABLE + OCCUPIED + NORMAL + LOCKED
        expect(deriveSlotDisplayStatus(slot())).toBe('AVAILABLE');
    });

    it('한 축만 어긋나도 대여 가능이 아니다', () => {
        // 잠금이 풀려 있으면 거래 중이라 재고로 셀 수 없습니다.
        expect(deriveSlotDisplayStatus(slot({ lockStatus: 'UNLOCKED' }))).not.toBe('AVAILABLE');
        expect(deriveSlotDisplayStatus(slot({ lockStatus: 'ERROR' }))).not.toBe('AVAILABLE');
        expect(deriveSlotDisplayStatus(slot({ itemCondition: 'UNKNOWN' }))).not.toBe('AVAILABLE');
    });

    it('관리자 확인이 가장 앞선다 — 다른 축이 정상이어도 격리가 먼저 보여야 한다', () => {
        expect(deriveSlotDisplayStatus(slot({ serviceStatus: 'ADMIN_REVIEW' }))).toBe(
            'ADMIN_REVIEW',
        );
        // 파손과 겹칠 때도 격리가 이깁니다.
        expect(
            deriveSlotDisplayStatus(
                slot({ serviceStatus: 'ADMIN_REVIEW', itemCondition: 'DAMAGED' }),
            ),
        ).toBe('ADMIN_REVIEW');
    });

    it('수리 가능도 파손으로 묶는다 — 어느 쪽이든 대여로 내보낼 수 없다', () => {
        expect(deriveSlotDisplayStatus(slot({ itemCondition: 'DAMAGED' }))).toBe('DAMAGED');
        expect(deriveSlotDisplayStatus(slot({ itemCondition: 'REPAIRABLE' }))).toBe('DAMAGED');
    });

    it('우산이 나가 있는 슬롯은 빈 슬롯으로 보인다', () => {
        /*
         * 관리자 API 어디에도 활성 대여 연결이 없습니다. 그래서 '대여 중' 이라는 표시를
         * 만들 수 없고, 서버 기준으로도 EMPTY + AVAILABLE 입니다 (12-R B-4).
         * 빈 슬롯의 itemCondition 은 null 로 옵니다.
         */
        expect(
            deriveSlotDisplayStatus(slot({ occupancyStatus: 'EMPTY', itemCondition: null })),
        ).toBe('EMPTY');
    });

    it('복구 필요 슬롯은 이용 중지로 수렴한다', () => {
        // ERD §9.2-7: 물리·DB 불일치는 RECOVERY_REQUIRED 와 OUT_OF_SERVICE 로 수렴한다.
        const isolated = slot({
            serviceStatus: 'OUT_OF_SERVICE',
            occupancyStatus: 'UNKNOWN',
            itemCondition: 'UNKNOWN',
            lockStatus: 'UNKNOWN',
        });
        expect(deriveSlotDisplayStatus(isolated)).toBe('OUT_OF_SERVICE');
    });

    it('확정할 수 없는 조합은 확인 필요로 떨어진다 — 성공으로 보이면 안 된다', () => {
        // 점유 확인 불가인데 서비스는 열려 있는 모순 상태. 대여 가능으로 새면 안 됩니다.
        expect(
            deriveSlotDisplayStatus(slot({ occupancyStatus: 'UNKNOWN', itemCondition: 'NORMAL' })),
        ).toBe('UNKNOWN');
    });
});

describe('formatSlotLabel', () => {
    it('slotNumber 하나로만 만든다', () => {
        // station_code 에 의존하던 'SL-03-01' 표기를 걷어낸 뒤의 계약입니다.
        expect(formatSlotLabel(1)).toBe('1번 슬롯');
        expect(formatSlotLabel(12)).toBe('12번 슬롯');
    });
});

describe('formatUpdatedAt', () => {
    it('마이크로초 원문을 파싱하지 않고 잘라서 보여준다', () => {
        /*
         * Date 로 파싱했다가 다시 만들면 DATETIME(6) 자릿수가 잘려 CAS 가 항상 409 가
         * 됩니다. 이 함수는 문자열만 자르므로 원문이 보존됩니다.
         */
        expect(formatUpdatedAt('2026-07-24 09:20:11.123456')).toBe('07-24 09:20');
    });
});

describe('getStationStatus', () => {
    it('장치 오류는 온라인으로 치지 않는다', () => {
        // ERROR 를 OFFLINE 과 합치면 장치 고장이 화면에서 사라집니다.
        expect(isDeviceOnline(station({ deviceStatus: 'ERROR' }))).toBe(false);
        expect(getStationStatus(station({ deviceStatus: 'ERROR', available: 5 }))).toBe('OFFLINE');
    });

    it('오프라인이 재고보다 앞선다', () => {
        expect(getStationStatus(station({ deviceStatus: 'OFFLINE', available: 5 }))).toBe(
            'OFFLINE',
        );
    });

    it('임계값 경계에서 갈린다', () => {
        expect(getStationStatus(station({ available: STOCK_THRESHOLD.surplus }))).toBe('SURPLUS');
        expect(getStationStatus(station({ available: STOCK_THRESHOLD.surplus - 1 }))).toBe(
            'NORMAL',
        );
        expect(getStationStatus(station({ available: STOCK_THRESHOLD.normal }))).toBe('NORMAL');
        expect(getStationStatus(station({ available: STOCK_THRESHOLD.normal - 1 }))).toBe(
            'SHORTAGE',
        );
    });
});

describe('sortByStock', () => {
    it('오프라인을 맨 뒤로 보내고 원본을 건드리지 않는다', () => {
        const input = [
            station({ stationId: 'a', deviceStatus: 'OFFLINE', available: 5 }),
            station({ stationId: 'b', available: 1 }),
            station({ stationId: 'c', available: 4 }),
        ];

        expect(sortByStock(input).map((s) => s.stationId)).toEqual(['c', 'b', 'a']);
        // 목록 훅이 캐시된 배열을 넘기므로 제자리 정렬이면 캐시가 오염됩니다.
        expect(input.map((s) => s.stationId)).toEqual(['a', 'b', 'c']);
    });
});
