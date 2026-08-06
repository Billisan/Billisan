import { env } from '@/config/env';
import { http } from '@/lib/axios';
import { errorStatusOf } from '@/lib/api-error';
import { REAL_STATIONS, type StationSeedEntry } from '@/features/stations/api/stationSeed';
import type { SlotStatusChange } from '@/features/stations/components/SlotStatusDialog';
import {
    SEED_ASOF,
    SEED_MODEL_VERSION,
    seedInspectionOfSlot,
    seedRentalOfSlot,
} from '@/features/stations/mocks/ec2Seed';
import { buildSlots } from '@/features/stations/mocks/slots';
import { applyOverride, isInspectionDecided } from '@/features/stations/mocks/slotOverrides';
import { findStation, listStations } from '@/features/stations/mocks/stations';
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

/**
 * 목업 슬롯에 상세 전용 필드를 붙입니다 — 전부 EC2 시드에서 가져옵니다.
 *
 * **`latestReturnAttempt` 는 '지금 나가 있는 대여'가 아니라 '최근 반납 시도'입니다.**
 * 그래서 대여 상태가 `ACTIVE`(아직 안 돌아옴)면 반납 시도가 없어 `null` 입니다.
 *
 * 반납 상태는 대여 상태에서 파생합니다. 시드 대여가 `COMPLETED` 라 반납도 `COMPLETED`
 * 입니다 — 반납 상태 머신이 완주한 뒤의 모습입니다 (`ec2Seed.ts` 참고).
 */
function toDetail(station: Station, slot: SlotSummary): SlotDetail {
    const inspection = seedInspectionOfSlot(slot.slotNumber);
    const rental = seedRentalOfSlot(slot.slotNumber);
    // 관리자가 방금 판정했으면 그 결과가 시드값을 이깁니다.
    const reviewStatus = inspection
        ? isInspectionDecided(slot.slotId)
            ? ('DECIDED' as const)
            : inspection.reviewStatus
        : null;
    const decided = reviewStatus === 'DECIDED';

    return {
        ...slot,
        stationId: station.stationId,
        latestReturnAttempt:
            rental?.returnAttemptId != null
                ? {
                      returnAttemptId: rental.returnAttemptId,
                      rentalId: rental.rentalId,
                      status: rental.status === 'COMPLETED' ? 'COMPLETED' : 'PHYSICAL_DONE',
                  }
                : null,
        latestInspection:
            inspection && reviewStatus
                ? {
                      inspectionId: inspection.inspectionId,
                      aiResult: inspection.aiResult,
                      aiScore: inspection.aiScore,
                      modelVersion: SEED_MODEL_VERSION,
                      processedAt: inspection.processedAt,
                      reviewStatus,
                      // 방금 판정한 건이면 슬롯 품질이 결과입니다. 아니면 시드값 그대로.
                      decision: !decided
                          ? null
                          : (inspection.decision ??
                            (slot.itemCondition === 'DAMAGED' ? 'DAMAGED' : 'NORMAL')),
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

/**
 * 명부에 없는 대여소를 위한 표시 정보.
 *
 * 서버에서 발견했지만 우리 명부에 이름이 없는 대여소입니다. 이름을 지어내지 않고
 * **축약 ID 를 그대로 보여 줍니다** — 관리자가 로그·백엔드와 대조할 수 있는 값이고,
 * 「알 수 없는 대여소」 같은 문구보다 실무에 쓸모가 있습니다.
 *
 * 좌표는 ERD 에 컬럼이 없어 어차피 화면 배치값입니다. ID 를 해시해 흩뿌려서 지도에서
 * 겹치지 않게만 합니다.
 */
function fallbackSeedOf(stationId: string): StationSeedEntry {
    let hash = 0;
    for (let i = 0; i < stationId.length; i += 1) {
        hash = (hash * 31 + stationId.charCodeAt(i)) >>> 0;
    }
    return {
        stationId,
        name: `${stationId.slice(0, 8)}…`,
        position: { x: 12 + (hash % 76), y: 12 + ((hash >>> 8) % 76) },
    };
}

function seedEntryOf(stationId: string): StationSeedEntry {
    return REAL_STATIONS.find((entry) => entry.stationId === stationId) ?? fallbackSeedOf(stationId);
}

/**
 * **서버에 실재하는 대여소 id 를 모읍니다.**
 *
 * 대여소 목록 API 가 없어서 예전에는 `stationSeed.ts` 에 UUID 를 박아 두고 그것만
 * 조회했습니다. 그러면 **DB 가 다시 시드되어 UUID 가 바뀌는 순간 화면이 통째로
 * 404** 입니다 — 실제로 V19 픽스처가 `22000000…` 로 바뀌면서 그 상황이 됩니다.
 *
 * 그래서 명부는 **후보**로만 쓰고, `ADMIN-INSPECTION-001` 응답의 `stationId` 로
 * 서버에 실재하는 대여소를 함께 발견합니다. 그 API 는 계약에 있고 응답 필수 필드라
 * 백엔드에 아무것도 요청하지 않아도 됩니다.
 *
 * **한계는 알고 씁니다**: 검수가 한 건도 없는 대여소는 발견되지 않습니다. 그런 곳은
 * 명부에 있어야 보입니다. 그래서 명부를 지우지 않고 합집합으로 둡니다.
 * TODO: 대여소 목록 API 가 생기면 이 함수를 그 호출로 바꾸세요.
 */
async function discoverStationIds(): Promise<string[]> {
    const seeded = REAL_STATIONS.map((entry) => entry.stationId);
    try {
        // inspectionsApi 를 부르지 않습니다 — 그쪽이 이 모듈을 import 해서 순환이 됩니다.
        const { data } = await http.get<{ items: Array<{ stationId: string }> }>('/inspections', {
            params: { size: 100 },
        });
        return [...new Set([...seeded, ...data.items.map((item) => item.stationId)])];
    } catch {
        // 검수 조회가 실패해도 명부만으로 진행합니다. 목록이 비는 것보다 낫습니다.
        return seeded;
    }
}

export const stationsApi = {
    /**
     * 대여소 목록.
     *
     * **P0 계약에 없는 API 입니다.** 관리자 8개에 대여소 목록이 없어서, 실 모드는
     * 발견한 대여소마다 재고 집계를 받아 조립합니다.
     *
     * **한 곳이 실패해도 나머지는 보여 줍니다.** 예전에는 `Promise.all` 이라 대여소
     * 하나가 404 면 목록 전체가 오류 화면이 됐습니다. 명부에 낡은 UUID 가 하나만
     * 섞여 있어도 멀쩡한 대여소가 전부 안 보이는 구조였습니다.
     *
     * TODO: 대여소 목록 API 가 계약에 들어오면 여기서 http 를 호출하세요.
     */
    list: async (): Promise<Station[]> => {
        if (!env.useMockData) {
            const ids = await discoverStationIds();
            const settled = await Promise.allSettled(
                ids.map(async (id) => composeStation(seedEntryOf(id), await stationsApi.inventory(id))),
            );
            return settled
                .filter(
                    (result): result is PromiseFulfilledResult<Station> =>
                        result.status === 'fulfilled',
                )
                .map((result) => result.value);
        }
        return delay(listStations());
    },

    /**
     * 대여소 하나.
     *
     * 명부에 없어도 **서버에 물어봅니다** — 검수에서 발견한 대여소는 명부에 없지만
     * 실재하고, 그 상세로 이동할 수 있어야 합니다. 서버가 404 면 `null` 을 돌려
     * 화면이 「없음」으로 가릅니다 (오류 화면이 아니라).
     */
    detail: async (stationId: string): Promise<Station | null> => {
        if (!env.useMockData) {
            try {
                return composeStation(
                    seedEntryOf(stationId),
                    await stationsApi.inventory(stationId),
                );
            } catch (error) {
                if (errorStatusOf(error) === 404) return null;
                throw error;
            }
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
             *
             * **표시용 문자열(`STATIONS_SYNCED_AT`)이 아니라 `SEED_ASOF` 입니다.** 스펙이
             * 이 필드를 `date-time` 으로 정했는데 예전에는 `'2026-07-24 09:20'` 같은 표시
             * 형식을 넣고 있었습니다. 화면은 두 형식을 다 견디지만(`formatServerTime`),
             * 계약을 어기는 값을 목업이 내보내면 실 API 로 갈아탈 때 차이가 드러납니다.
             */
            asOf: SEED_ASOF,
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
