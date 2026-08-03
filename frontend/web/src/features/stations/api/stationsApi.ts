import { env } from '@/config/env';
import { http } from '@/lib/axios';
import { errorStatusOf } from '@/lib/api-error';
import { MODEL_VERSION, aiResultOf, aiScoreOf } from '@/features/inspections/mocks/aiVerdict';
import { REAL_STATIONS, type StationSeedEntry } from '@/features/stations/api/stationSeed';
import type { SlotStatusChange } from '@/features/stations/components/SlotStatusDialog';
import { MOCK_NS, mockUuid } from '@/features/stations/mocks/ids';
import { buildSlots, inspectionStateOf, slotSeq } from '@/features/stations/mocks/slots';
import { applyOverride, isInspectionDecided } from '@/features/stations/mocks/slotOverrides';
import { findStation, listStations, STATIONS_SYNCED_AT } from '@/features/stations/mocks/stations';
import type { SlotDetail, SlotSummary, Station } from '@/features/stations/types';

/**
 * 관리자 재고·슬롯 — `ADMIN-INVENTORY-001` · `ADMIN-SLOT-001` · `ADMIN-SLOT-DETAIL-001` ·
 * `ADMIN-SLOT-STATUS-001` (12-R PART B-4).
 *
 * **화면은 이 파일만 보고, 목업은 여기 뒤에 숨습니다.** `env.useMockData` 를 내리면
 * 실 API 로 갈아탑니다 — 페이지 코드는 건드리지 않습니다.
 *
 * 경로 변수는 전부 UUID 입니다. 'ST-003' 같은 표시 코드를 넣으면 안 됩니다.
 */

/** 왕복이 있는 척해서 로딩 상태를 눈으로 확인할 수 있게 합니다. */
function delay<T>(value: T, ms = 180): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/**
 * `ADMIN-INVENTORY-001` 응답 `data`.
 *
 * 명세 주석: "집계 항목은 서로 겹칠 수 있으므로 모든 count를 단순 합산해 전체 수를 계산하지 않는다."
 * '대여 중' 집계는 없습니다 — 관리자 API 는 활성 대여를 노출하지 않습니다.
 */
export interface InventorySummary {
    stationId: string;
    totalSlotCount: number;
    occupiedSlotCount: number;
    emptySlotCount: number;
    unknownOccupancySlotCount: number;
    /** `OCCUPIED + NORMAL + AVAILABLE + LOCKED` 를 모두 만족하는 사용 가능 우산 수 */
    availableUmbrellaCount: number;
    adminReviewSlotCount: number;
    outOfServiceSlotCount: number;
    damagedUmbrellaCount: number;
    /** 집계 기준 서버 시각 */
    asOf: string;
}

/** `ADMIN-SLOT-001` 응답 `data`. cursor 를 쓰지 않습니다. */
export interface SlotListResponse {
    stationId: string;
    items: SlotSummary[];
}

/** 목업 슬롯에 상세 전용 필드를 붙입니다. */
function toDetail(station: Station, slot: SlotSummary): SlotDetail {
    const seq = slotSeq(station, slot.slotNumber);
    const seeded = inspectionStateOf(station, slot.slotNumber);
    // 관리자가 방금 판정했으면 그 결과가 우선입니다.
    const reviewStatus = seeded
        ? isInspectionDecided(slot.slotId)
            ? ('DECIDED' as const)
            : seeded
        : null;
    const decided = reviewStatus === 'DECIDED';

    return {
        ...slot,
        stationId: station.stationId,
        latestReturnAttempt: seeded
            ? {
                  returnAttemptId: mockUuid(MOCK_NS.returnAttempt, seq),
                  rentalId: mockUuid(MOCK_NS.rental, seq),
                  status: 'COMPLETED',
              }
            : null,
        latestInspection: reviewStatus
            ? {
                  inspectionId: mockUuid(MOCK_NS.inspection, seq),
                  aiResult: aiResultOf(slot, decided),
                  aiScore: aiScoreOf(slot, decided),
                  modelVersion: MODEL_VERSION,
                  processedAt: slot.updatedAt,
                  reviewStatus,
                  decision: decided
                      ? slot.itemCondition === 'DAMAGED'
                          ? 'DAMAGED'
                          : 'NORMAL'
                      : null,
              }
            : null,
        updatedBy: null,
    };
}

/**
 * 시드 명부 + `ADMIN-INVENTORY-001` 로 Station 을 짜 맞춥니다.
 *
 * 목록 API 가 없는 실 모드에서 재고 집계가 유일한 대여소 단위 실데이터입니다.
 *
 * **`deviceStatus` 는 `null`(알 수 없음)입니다.** 예전에는 `'ONLINE'` 을 박아 넣었는데,
 * 재고 API 가 응답한 건 **서버가 살아 있다**는 뜻이지 **현장의 함이 살아 있다**는 뜻이
 * 아닙니다. 함이 어제부터 꺼져 있어도 DB 슬롯 행은 그대로라 서버는 200 을 돌려주고,
 * 화면만 「연결됨」이라고 거짓말하게 됩니다. `STATION.device_status` 는 DB 에 있는데
 * 그걸 내보내는 관리자 API 가 없습니다(스웨거 9개 경로 전수 확인).
 *
 * `serviceStatus` 는 `AVAILABLE` 로 둡니다 — 재고 조회가 성공한 대여소이고, 이 값은
 * 화면에서 판단에 쓰지 않습니다(표시는 슬롯 4축과 재고 비율로 합니다).
 *
 * TODO: 대여소 조회 API 가 `device_status`·`last_seen_at` 을 주면 그 값으로 바꾸세요.
 */
function composeStation(seed: StationSeedEntry, inventory: InventorySummary): Station {
    return {
        stationId: seed.stationId,
        name: seed.name,
        position: seed.position,
        serviceStatus: 'AVAILABLE',
        deviceStatus: null,
        slotCount: inventory.totalSlotCount,
        capacity: inventory.totalSlotCount,
        available: inventory.availableUmbrellaCount,
        damaged: inventory.damagedUmbrellaCount,
        adminReview: inventory.adminReviewSlotCount,
        unknownOccupancy: inventory.unknownOccupancySlotCount,
    };
}

export const stationsApi = {
    /**
     * 대여소 목록.
     *
     * **P0 계약에 없는 API 입니다.** 관리자 10개에 대여소 목록이 없어서, 실 모드는
     * 시드 명부(stationSeed.ts)의 대여소마다 재고 집계를 받아 조립합니다.
     * TODO: 대여소 목록 API 가 계약에 들어오면 여기서 http 를 호출하세요.
     */
    list: async (): Promise<Station[]> => {
        if (!env.useMockData) {
            return Promise.all(
                REAL_STATIONS.map(async (seed) =>
                    composeStation(seed, await stationsApi.inventory(seed.stationId)),
                ),
            );
        }
        return delay(listStations());
    },

    /** 대여소 하나. 목록과 같은 방식입니다. */
    detail: async (stationId: string): Promise<Station | null> => {
        if (!env.useMockData) {
            const seed = REAL_STATIONS.find((entry) => entry.stationId === stationId);
            if (!seed) return null;
            return composeStation(seed, await stationsApi.inventory(stationId));
        }
        return delay(findStation(stationId) ?? null);
    },

    /** ADMIN-INVENTORY-001 — `GET /stations/{stationId}/inventory` */
    inventory: async (stationId: string): Promise<InventorySummary> => {
        if (!env.useMockData) {
            const { data } = await http.get<InventorySummary>(`/stations/${stationId}/inventory`);
            return data;
        }

        const station = findStation(stationId);
        const slots = station ? buildSlots(station) : [];
        const summary: InventorySummary = {
            stationId,
            totalSlotCount: slots.length,
            occupiedSlotCount: 0,
            emptySlotCount: 0,
            unknownOccupancySlotCount: 0,
            availableUmbrellaCount: 0,
            adminReviewSlotCount: 0,
            outOfServiceSlotCount: 0,
            damagedUmbrellaCount: 0,
            /*
             * **현재 시각이 아니라 목업 기준 시각입니다.**
             *
             * `new Date()` 를 쓰면 목업 슬롯이 07-24 로 고정돼 있는데 집계만 오늘 시각을
             * 달고 나옵니다. 화면은 이 값을 「… 기준」으로 그대로 찍으므로, 며칠 전 데이터를
             * 방금 센 것처럼 보여 주게 됩니다.
             *
             * 계약상 `asOf` 는 "집계 기준 서버 시각" 이라 실 API 에서는 서버가 채웁니다.
             * 목업은 자기 데이터가 언제 것인지를 말해야 맞습니다.
             */
            asOf: STATIONS_SYNCED_AT,
        };

        for (const slot of slots) {
            if (slot.occupancyStatus === 'OCCUPIED') summary.occupiedSlotCount += 1;
            if (slot.occupancyStatus === 'EMPTY') summary.emptySlotCount += 1;
            if (slot.occupancyStatus === 'UNKNOWN') summary.unknownOccupancySlotCount += 1;
            if (slot.serviceStatus === 'ADMIN_REVIEW') summary.adminReviewSlotCount += 1;
            if (slot.serviceStatus === 'OUT_OF_SERVICE') summary.outOfServiceSlotCount += 1;
            if (slot.occupancyStatus === 'OCCUPIED' && slot.itemCondition === 'DAMAGED') {
                summary.damagedUmbrellaCount += 1;
            }
            if (
                slot.occupancyStatus === 'OCCUPIED' &&
                slot.itemCondition === 'NORMAL' &&
                slot.serviceStatus === 'AVAILABLE' &&
                slot.lockStatus === 'LOCKED'
            ) {
                summary.availableUmbrellaCount += 1;
            }
        }

        return delay(summary);
    },

    /**
     * ADMIN-SLOT-001 — `GET /stations/{stationId}/slots`
     *
     * "P0 목록은 소규모 고정 구성으로 cursor를 사용하지 않는다." 대여소당 3~5개뿐입니다.
     */
    slots: async (stationId: string): Promise<SlotListResponse> => {
        if (!env.useMockData) {
            const { data } = await http.get<SlotListResponse>(`/stations/${stationId}/slots`);
            return data;
        }

        const station = findStation(stationId);
        return delay({ stationId, items: station ? buildSlots(station) : [] });
    },

    /** ADMIN-SLOT-DETAIL-001 — `GET /slots/{slotId}` */
    slotDetail: async (slotId: string): Promise<SlotDetail | null> => {
        if (!env.useMockData) {
            try {
                const { data } = await http.get<SlotDetail>(`/slots/${slotId}`);
                return data;
            } catch (error) {
                /*
                 * 404(`SLOT_NOT_FOUND`, EC2 실측)는 "정말 없음"입니다. 예외로 두면 화면이
                 * 「조회 실패 · 다시 시도」를 띄우는데, 없는 슬롯은 다시 시도해도 없습니다.
                 * null 로 돌려 NotFoundState(목록으로 돌아가기)로 가릅니다.
                 */
                if (errorStatusOf(error) === 404) return null;
                throw error;
            }
        }

        for (const station of listStations()) {
            const found = buildSlots(station).find((slot) => slot.slotId === slotId);
            if (found) return delay(applyOverride(toDetail(station, found)));
        }
        return delay(null);
    },

    /**
     * ADMIN-SLOT-STATUS-001 — `PATCH /slots/{slotId}/status`
     *
     * `reasonCode` 는 **필수**입니다. 빠지면 `422 ADMIN_REASON_REQUIRED` 입니다.
     * CAS 는 `expectedUpdatedAt` 하나뿐이고, 409 가 나면 **자동 재적용하지 않습니다** —
     * 최신 상태를 다시 조회해서 관리자가 다시 판단해야 합니다 (12-R B-6).
     */
    changeSlotStatus: async (slot: SlotSummary, change: SlotStatusChange): Promise<void> => {
        if (!env.useMockData) {
            await http.patch(`/slots/${slot.slotId}/status`, {
                targetServiceStatus: change.targetServiceStatus,
                targetItemCondition: change.targetItemCondition,
                reasonCode: change.reasonCode,
                note: change.note || null,
                physicalStateConfirmed: change.physicalStateConfirmed,
                // 조회 응답 문자열을 그대로 되돌려 보냅니다 (마이크로초 보존).
                expectedUpdatedAt: slot.updatedAt,
            });
            return;
        }

        const { applySlotStatusChange } = await import('@/features/stations/mocks/slotOverrides');
        applySlotStatusChange(slot, change);
        await delay(null, 120);
    },
};
