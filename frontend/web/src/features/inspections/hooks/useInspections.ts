import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
