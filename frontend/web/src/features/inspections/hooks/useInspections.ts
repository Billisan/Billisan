import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
    inspectionsApi,
    type InspectionListParams,
} from '@/features/inspections/api/inspectionsApi';
import type { InspectionDecisionInput } from '@/features/inspections/types';
import { errorCodeOf } from '@/lib/api-error';
import { qk } from '@/shared/api/queryKeys';
import { toast } from '@/shared/components/toast/toastStore';

/**
 * 검수 조회·판정 훅.
 *
 * 조회 실패는 자동 재시도하지 않습니다 — 관리자 오류 10종이 전부 `retryable=false` 입니다.
 */

/** ADMIN-INSPECTION-001 */
export function useInspectionList(params: InspectionListParams) {
    return useQuery({
        queryKey: qk.inspections.list(params as Record<string, unknown>),
        queryFn: () => inspectionsApi.list(params),
        retry: false,
        /**
         * 커서 목록은 이전 쪽 데이터를 잠시 붙들고 있어야 '다음'을 눌렀을 때
         * 표가 비었다가 다시 차는 깜빡임이 없습니다.
         */
        placeholderData: (previous) => previous,
    });
}

/**
 * 슬롯 → 미처리 검수 ID 매핑 — `ACT-WEB-INVENTORY-004` 검수 상세 이동용.
 *
 * 재고·슬롯 목록(`ADMIN-SLOT-001`)에는 검수 정보가 없습니다. `serviceStatus=ADMIN_REVIEW` 로
 * "격리됐다"까지만 알 수 있고, 검수 상세로 가는 데 필요한 `inspectionId` 가 없습니다.
 *
 * 그래서 **응답을 늘려 달라고 하지 않고 있는 API 로 풉니다.** `ADMIN-INSPECTION-001` 응답
 * `items[]` 에 `slotId` 가 필수로 들어 있어서, 미처리 목록을 한 번 받아 슬롯 기준으로 뒤집으면
 * 어느 슬롯의 검수가 무엇인지 알 수 있습니다.
 *
 * **한계 하나는 알고 씁니다.** 이 목록은 cursor 페이지네이션이고 한 번에 최대 100건입니다.
 * 미처리가 100건을 넘으면 뒷장의 슬롯은 매핑이 비고, 그 행은 검수 버튼 없이 상세 링크만
 * 남습니다 (틀린 곳으로 보내지 않습니다). P0 구성은 대여소 8곳 × 슬롯 3~5개라 여유가 큽니다.
 */
export function usePendingInspectionBySlot() {
    const query = useInspectionList({ reviewStatus: 'PENDING', size: 100 });

    const bySlot = useMemo(() => {
        const map = new Map<string, string>();
        for (const item of query.data?.items ?? []) {
            // 같은 슬롯에 미처리가 여럿이면 목록 정렬(미처리 우선·최신순)의 첫 건을 씁니다.
            if (!map.has(item.slotId)) map.set(item.slotId, item.inspectionId);
        }
        return map;
    }, [query.data]);

    return bySlot;
}

/** ADMIN-INSPECTION-002 */
export function useInspection(inspectionId: string | undefined) {
    return useQuery({
        queryKey: qk.inspections.detail(inspectionId ?? ''),
        queryFn: () => inspectionsApi.detail(inspectionId!),
        enabled: Boolean(inspectionId),
        retry: false,
    });
}

/**
 * ADMIN-INSPECTION-003.
 *
 * 판정은 검수·슬롯·정산을 한 트랜잭션으로 바꿉니다. 그래서 성공 뒤 세 캐시를 다 무효화하고
 * 권위 상세를 재조회합니다. 409 는 자동 재적용하지 않습니다 (API명세 B-5).
 */
export function useDecideInspection() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            inspectionId,
            input,
        }: {
            inspectionId: string;
            input: InspectionDecisionInput;
        }) => inspectionsApi.decide(inspectionId, input),
        retry: false,
        onSuccess: (_result, { input }) => {
            // 보류는 슬롯이 그대로라 화면이 거의 안 바뀝니다. 알림이 없으면 눌렸는지 모릅니다.
            toast.success(
                input.decision === 'KEEP_ADMIN_REVIEW'
                    ? '판정을 보류했습니다'
                    : '판정을 저장했습니다',
                input.decision === 'DAMAGED' ? '파손 정산이 함께 생성됩니다.' : undefined,
            );
            queryClient.invalidateQueries({ queryKey: qk.inspections.all });
            queryClient.invalidateQueries({ queryKey: qk.slots.all });
            queryClient.invalidateQueries({ queryKey: qk.stations.all });
        },
        onError: (error) => {
            const code = errorCodeOf(error);
            const known: Record<string, string> = {
                CONCURRENT_MODIFICATION: '다른 관리자가 먼저 처리했습니다',
                INSPECTION_ALREADY_DECIDED: '이미 판정이 끝난 검수입니다',
                ADMIN_REASON_REQUIRED: '사유 코드가 필요합니다',
                INVALID_INSPECTION_DECISION: '허용되지 않은 판정입니다',
            };
            toast.error(
                (code && known[code]) || '판정을 저장하지 못했습니다',
                `${error.message}${code ? ` (${code})` : ''}`,
            );
            queryClient.invalidateQueries({ queryKey: qk.inspections.all });
        },
    });
}
