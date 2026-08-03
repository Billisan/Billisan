import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { SlotStatusChange } from '@/features/stations/components/SlotStatusDialog';
import { stationsApi } from '@/features/stations/api/stationsApi';
import type { SlotSummary } from '@/features/stations/types';
import { errorCodeOf } from '@/lib/api-error';
import { qk } from '@/shared/api/queryKeys';
import { toast } from '@/shared/components/toast/toastStore';

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

/** ADMIN-SLOT-001. cursor 가 없어 한 번에 다 옵니다. */
export function useStationSlots(stationId: string | undefined) {
    return useQuery({
        queryKey: qk.slots.list(stationId ?? '', {}),
        queryFn: () => stationsApi.slots(stationId!),
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
        mutationFn: ({ slot, change }: { slot: SlotSummary; change: SlotStatusChange }) =>
            stationsApi.changeSlotStatus(slot, change),
        retry: false,
        onSuccess: () => {
            toast.success('슬롯 상태를 변경했습니다');
            queryClient.invalidateQueries({ queryKey: qk.slots.all });
            queryClient.invalidateQueries({ queryKey: qk.stations.all });
            // 슬롯 상태가 바뀌면 검수 목록의 표시도 따라 바뀝니다.
            queryClient.invalidateQueries({ queryKey: qk.inspections.all });
        },
        /*
         * 실패를 조용히 넘기면 관리자가 바뀐 줄 착각합니다. 409 는 특히 위험합니다 —
         * 다른 관리자가 먼저 바꾼 상태라 자동 재적용하면 안 되고, 최신 상태를 다시 봐야 합니다.
         */
        onError: (error) => {
            const code = errorCodeOf(error);
            /*
             * **충돌 코드는 `SLOT_STATUS_CONFLICT` 입니다.**
             *
             * 검수 판정은 `CONCURRENT_MODIFICATION`, 슬롯 상태 변경은
             * `SLOT_STATUS_CONFLICT` 로 서버가 갈라 씁니다(백엔드 GlobalExceptionHandler).
             * 여기서 `CONCURRENT_MODIFICATION` 만 보고 있어서, 실제 충돌이 나면 안내 대신
             * 원시 코드가 그대로 떴습니다 — 관리자가 뭘 해야 하는지 모릅니다.
             * 둘 다 받아 두면 서버가 어느 쪽을 주든 같은 안내가 나갑니다.
             */
            const conflict = code === 'SLOT_STATUS_CONFLICT' || code === 'CONCURRENT_MODIFICATION';
            toast.error(
                conflict
                    ? '다른 관리자가 먼저 상태를 변경했습니다'
                    : '슬롯 상태를 변경하지 못했습니다',
                conflict
                    ? '최신 상태를 다시 확인한 뒤 진행하세요.'
                    : `${error.message}${code ? ` (${code})` : ''}`,
            );
            // 서버가 이미 바뀌었을 수 있으니 권위 상태를 다시 읽습니다.
            queryClient.invalidateQueries({ queryKey: qk.slots.all });
        },
    });
}
