import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { SlotStatusChange } from '@/features/stations/components/SlotStatusDialog';
import { stationsApi, type SlotListParams } from '@/features/stations/api/stationsApi';
import type { Slot } from '@/features/stations/types';
import { qk } from '@/shared/api/queryKeys';

/**
 * 재고·슬롯 조회 훅.
 *
 * 화면은 목업인지 실 API 인지 몰라야 합니다. 그 분기는 `stationsApi` 안에만 있습니다.
 *
 * 조회 실패는 자동 재시도하지 않습니다. 관리자 오류 10종이 전부 `retryable=false` 이고,
 * 401·403 을 반복 호출해 봐야 같은 답만 옵니다 (API명세 B-5).
 */

export function useStations() {
    return useQuery({
        queryKey: qk.stations.all,
        queryFn: stationsApi.list,
        retry: false,
    });
}

export function useStation(stationId: string | undefined) {
    return useQuery({
        queryKey: [...qk.stations.all, stationId],
        queryFn: () => stationsApi.detail(stationId!),
        enabled: Boolean(stationId),
        retry: false,
    });
}

/** ADMIN-INVENTORY-001 */
export function useInventory(stationId: string | undefined) {
    return useQuery({
        queryKey: qk.stations.inventory(stationId ?? ''),
        queryFn: () => stationsApi.inventory(stationId!),
        enabled: Boolean(stationId),
        retry: false,
    });
}

/** ADMIN-SLOT-001 */
export function useStationSlots(stationId: string | undefined, params: SlotListParams = {}) {
    return useQuery({
        queryKey: qk.slots.list(stationId ?? '', params as Record<string, unknown>),
        queryFn: () => stationsApi.slots(stationId!, params),
        enabled: Boolean(stationId),
        retry: false,
    });
}

/** ADMIN-SLOT-DETAIL-001 */
export function useSlotDetail(slotId: string | undefined) {
    return useQuery({
        queryKey: qk.slots.detail(slotId ?? ''),
        queryFn: () => stationsApi.slotDetail(slotId!),
        enabled: Boolean(slotId),
        retry: false,
    });
}

/**
 * ADMIN-SLOT-STATUS-001.
 *
 * 성공하면 슬롯·재고 캐시를 통째로 무효화합니다. 낙관적 갱신(optimistic update)은 쓰지 않습니다 —
 * 계약이 "명령 성공 뒤 **권위 상세를 재조회**한다"이고, 클라이언트가 결과를 지어내면
 * 409 가 났을 때 화면에 없는 상태가 남습니다 (API명세 B-5).
 */
export function useChangeSlotStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ slot, change }: { slot: Slot; change: SlotStatusChange }) =>
            stationsApi.changeSlotStatus(slot, change),
        retry: false,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.slots.all });
            queryClient.invalidateQueries({ queryKey: qk.stations.all });
            // 슬롯 상태가 바뀌면 검수 목록의 표시도 따라 바뀝니다.
            queryClient.invalidateQueries({ queryKey: qk.inspections.all });
        },
    });
}
