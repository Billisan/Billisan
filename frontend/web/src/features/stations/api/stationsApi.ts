import { env } from '@/config/env';
import { http } from '@/lib/axios';
import { buildSlots } from '@/features/stations/mocks/slots';
import { findStation, MOCK_STATIONS } from '@/features/stations/mocks/stations';
import { applySlotStatusChange } from '@/features/stations/mocks/slotOverrides';
import type { SlotStatusChange } from '@/features/stations/components/SlotStatusDialog';
import { deriveSlotDisplayStatus, type Slot, type Station } from '@/features/stations/types';
import type { CursorPage } from '@/shared/types/api';

/**
 * 관리자 재고·슬롯 — `ADMIN-INVENTORY-001` · `ADMIN-SLOT-001` · `ADMIN-SLOT-DETAIL-001` ·
 * `ADMIN-SLOT-STATUS-001` (API명세 B-3).
 *
 * **화면은 이 파일만 보고, 목업은 여기 뒤에 숨습니다.** 백엔드가 붙으면 `env.useMockData` 를
 * 내리는 것만으로 실 API 로 갈아탑니다 — 페이지 코드는 건드리지 않습니다.
 *
 * 경로 변수는 전부 UUID 입니다 (`station_id`, `slot_id`). 'ST-003' 같은 표시 코드를 넣으면 안 됩니다.
 */

/** 왕복이 있는 척해서 로딩 상태를 눈으로 확인할 수 있게 합니다. */
function delay<T>(value: T, ms = 180): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** `ADMIN-INVENTORY-001` 집계 응답. 슬롯 행을 세어 나오는 값입니다 (ERD §6.1). */
export interface InventorySummary {
    stationId: string;
    available: number;
    rented: number;
    adminReview: number;
    damaged: number;
    total: number;
}

export interface SlotListParams {
    /** 서버가 주는 불투명 문자열. 클라이언트는 해석하지 않습니다. */
    cursor?: string | null;
    size?: number;
}

export const stationsApi = {
    /**
     * 대여소 목록.
     *
     * **P0 계약에 없는 API 입니다.** 관리자 10개에 대여소 목록이 없어서, 지금은 목업만 돌려줍니다.
     * 대시보드·대여소 관리 화면은 P1 이라 계약이 비구체화 상태입니다 (11번 §5).
     * TODO: 대여소 목록 API 가 계약에 들어오면 여기서 http 를 호출하세요.
     */
    list: async (): Promise<Station[]> => delay(MOCK_STATIONS),

    /** 대여소 하나. 위와 같은 이유로 목업입니다. */
    detail: async (stationId: string): Promise<Station | undefined> =>
        delay(findStation(stationId)),

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
            available: 0,
            rented: 0,
            adminReview: 0,
            damaged: 0,
            total: slots.length,
        };

        for (const slot of slots) {
            const display = deriveSlotDisplayStatus(slot);
            if (display === 'AVAILABLE') summary.available += 1;
            if (display === 'RENTED') summary.rented += 1;
            // §7.2 와 같은 기준: ADMIN_REVIEW 이거나 미처리 검수가 남아 있으면 확인 대상입니다.
            if (display === 'ADMIN_REVIEW' || slot.inspection?.reviewStatus === 'PENDING') {
                summary.adminReview += 1;
            }
            if (display === 'DAMAGED') summary.damaged += 1;
        }

        return delay(summary);
    },

    /** ADMIN-SLOT-001 — `GET /stations/{stationId}/slots` */
    slots: async (stationId: string, params: SlotListParams = {}): Promise<CursorPage<Slot>> => {
        if (!env.useMockData) {
            const { data } = await http.get<CursorPage<Slot>>(`/stations/${stationId}/slots`, {
                params,
            });
            return data;
        }

        const station = findStation(stationId);
        const all = station ? buildSlots(station) : [];
        const size = params.size ?? all.length;
        // cursor 는 서버만 해석합니다. 이 목업이 서버 역할이라 여기서만 풀어 씁니다.
        const offset = params.cursor ? Number(params.cursor.replace('c_', '')) : 0;
        const items = all.slice(offset, offset + size);
        const next = offset + size;

        return delay({ items, nextCursor: next < all.length ? `c_${next}` : null });
    },

    /** ADMIN-SLOT-DETAIL-001 — `GET /slots/{slotId}` */
    slotDetail: async (slotId: string): Promise<Slot | undefined> => {
        if (!env.useMockData) {
            const { data } = await http.get<Slot>(`/slots/${slotId}`);
            return data;
        }

        for (const station of MOCK_STATIONS) {
            const found = buildSlots(station).find((slot) => slot.slotId === slotId);
            if (found) return delay(found);
        }
        return delay(undefined);
    },

    /**
     * ADMIN-SLOT-STATUS-001 — `PATCH /slots/{slotId}/status`
     *
     * CAS 는 `expectedUpdatedAt` 하나뿐입니다. 409 가 나면 **자동 재적용하지 않습니다** —
     * 최신 상태를 다시 조회해서 관리자가 다시 판단해야 합니다 (API명세 B-5).
     */
    changeSlotStatus: async (slot: Slot, change: SlotStatusChange): Promise<Slot> => {
        if (!env.useMockData) {
            const { data } = await http.patch<Slot>(`/slots/${slot.slotId}/status`, {
                targetServiceStatus: change.targetServiceStatus,
                targetItemCondition: change.targetItemCondition,
                note: change.note,
                physicalStateConfirmed: change.physicalStateConfirmed,
                // 조회 응답 문자열을 그대로 되돌려 보냅니다 (마이크로초 보존).
                expectedUpdatedAt: slot.updatedAt,
            });
            return data;
        }

        applySlotStatusChange(slot, change);
        const updated = await stationsApi.slotDetail(slot.slotId);
        return updated ?? slot;
    },
};
