import { describe, expect, it } from 'vitest';

import {
    SLOT_DISPLAY_TONE,
    deriveSlotDisplayStatus,
    formatSlotLabel,
    formatUpdatedAt,
    getStationStatus,
    isDeviceOffline,
    isDeviceOnline,
    slotStatusHint,
    slotStatusText,
    sortByStock,
    STOCK_RATIO_THRESHOLD,
    stockRatio,
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
        unknownOccupancy: 0,
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

describe('slotStatusHint', () => {
    it('배지와 같은 글자를 두 번 쓰지 않는다 — UNKNOWN 은 한글 뜻을 돌려준다', () => {
        /*
         * `SLOT_DISPLAY_LABEL.UNKNOWN` 만 배지 글자가 이미 코드입니다(의도한 예외).
         * 그대로 `codeHint` 를 태우면 'UNKNOWN · UNKNOWN' 이라 마우스오버가 아무것도
         * 보태지 않습니다. 배지에서 뺀 한글 뜻이 여기로 와야 합니다.
         */
        expect(slotStatusText('UNKNOWN')).toBe('UNKNOWN');
        expect(slotStatusHint('UNKNOWN')).toBe('상태 불명 · UNKNOWN');
    });

    it('나머지는 `한글 · CODE` 모양을 그대로 지킨다', () => {
        expect(slotStatusHint('ADMIN_REVIEW')).toBe('판정 대기 · ADMIN_REVIEW');
        expect(slotStatusHint('OUT_OF_SERVICE')).toBe('이용 중지 · OUT_OF_SERVICE');
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

    /**
     * **장치 상태를 모르는 것과 끊긴 것은 다릅니다.**
     *
     * `STATION.device_status` 를 주는 관리자 API 가 없어 실 모드에서는 `null` 이 옵니다.
     * 이걸 `!isDeviceOnline()` 으로 판단하면 **전 대여소가 오프라인**이 되어, 재고가
     * 멀쩡한 곳까지 「연결 끊김」으로 그리고 대시보드에 거짓 경고가 뜹니다.
     */
    it('장치 상태를 모르면(null) 오프라인으로 단정하지 않는다', () => {
        const unknown = station({ deviceStatus: null, available: 4, capacity: 5 });

        expect(isDeviceOnline(unknown)).toBe(false); // 연결됐다고도 못 합니다
        expect(isDeviceOffline(unknown)).toBe(false); // 끊겼다고도 못 합니다
        // 재고 비율로 판정이 넘어갑니다 (4/5 = 과잉)
        expect(getStationStatus(unknown)).toBe('SURPLUS');
    });

    it('끊긴 것이 확인된 경우만 오프라인으로 센다', () => {
        expect(isDeviceOffline(station({ deviceStatus: 'OFFLINE' }))).toBe(true);
        expect(isDeviceOffline(station({ deviceStatus: 'ERROR' }))).toBe(true);
        expect(isDeviceOffline(station({ deviceStatus: 'ONLINE' }))).toBe(false);
    });

    /**
     * 화면흐름 §13 이 "재고 **비율**에서 파생"으로 정했습니다.
     *
     * 개수로 가르던 시절에는 슬롯 3개짜리가 꽉 차 있어도(3/3) 「적정」이라 재배치 후보에서
     * 빠졌습니다. 대여소마다 슬롯이 3~5개로 다르므로 규모를 나눠 봐야 뜻이 통합니다.
     */
    it.each([
        // 슬롯 5개 — 예전 개수 기준과 결과가 같습니다.
        [5, 5, 'SURPLUS'],
        [5, 4, 'SURPLUS'],
        [5, 3, 'NORMAL'],
        [5, 2, 'NORMAL'],
        [5, 1, 'SHORTAGE'],
        [5, 0, 'SHORTAGE'],
        // 슬롯 4개 — 3/4(75%)가 적정에서 과잉으로 바뀝니다.
        [4, 4, 'SURPLUS'],
        [4, 3, 'SURPLUS'],
        [4, 2, 'NORMAL'],
        [4, 1, 'SHORTAGE'],
        // 슬롯 3개 — 꽉 차 있으면 과잉, 1개만 남으면 적정입니다.
        [3, 3, 'SURPLUS'],
        [3, 2, 'SURPLUS'],
        [3, 1, 'NORMAL'],
        [3, 0, 'SHORTAGE'],
    ])('슬롯 %i개에 %i개 남으면 %s', (capacity, available, expected) => {
        expect(getStationStatus(station({ capacity, available }))).toBe(expected);
    });

    it('비율 경계값 자체는 위쪽 상태에 속한다', () => {
        // 2/3 는 과잉, 1/3 은 적정 — '이상'이므로 경계는 위 칸입니다.
        expect(stockRatio(station({ capacity: 3, available: 2 }))).toBeCloseTo(
            STOCK_RATIO_THRESHOLD.surplus,
        );
        expect(getStationStatus(station({ capacity: 3, available: 2 }))).toBe('SURPLUS');
        expect(getStationStatus(station({ capacity: 3, available: 1 }))).toBe('NORMAL');
    });

    /** 슬롯이 없으면 0으로 나누게 됩니다. NaN 이 조용히 부족으로 떨어지는 걸 막아 둔 자리입니다. */
    it('슬롯이 0개면 비율 0, 부족으로 본다', () => {
        expect(stockRatio(station({ capacity: 0, available: 0 }))).toBe(0);
        expect(getStationStatus(station({ capacity: 0, available: 0 }))).toBe('SHORTAGE');
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

describe('슬롯 표시 색', () => {
    it('여섯 상태가 서로 다른 색이다', () => {
        /*
         * 예전에는 `빈 슬롯`·`이용 중지`·`확인 필요` 셋이 모두 회색이라 표에서
         * 구분되지 않았습니다. 성격이 전혀 다른 상태들입니다 — 빈 슬롯은 정상이고
         * 이용 중지는 사람이 손대야 풀립니다.
         */
        const tones = Object.values(SLOT_DISPLAY_TONE);
        expect(new Set(tones).size, `색 중복: ${JSON.stringify(SLOT_DISPLAY_TONE)}`).toBe(
            tones.length,
        );
    });

    it('정상 상태만 초록이고, 문제 상태는 회색이 아니다', () => {
        expect(SLOT_DISPLAY_TONE.AVAILABLE).toBe('green');
        // 회색은 '아무 일 없음'입니다. 빈 슬롯만 해당합니다.
        expect(SLOT_DISPLAY_TONE.EMPTY).toBe('slate');
        for (const status of ['DAMAGED', 'ADMIN_REVIEW', 'OUT_OF_SERVICE', 'UNKNOWN'] as const) {
            expect(SLOT_DISPLAY_TONE[status], status).not.toBe('slate');
            expect(SLOT_DISPLAY_TONE[status], status).not.toBe('green');
        }
    });
});
