import { useQuery } from '@tanstack/react-query';

import { historyApi } from '@/features/history/api/historyApi';

/**
 * 이력 조회 훅.
 *
 * 전부 P1 이라 확정 API 가 없고 지금은 목업이 뒤에 있습니다. 화면은 그 사실을 모릅니다.
 * 조회 실패는 자동 재시도하지 않습니다 — 관리자 오류는 전부 `retryable=false` 입니다.
 */

const qk = {
    rentals: ['history', 'rentals'] as const,
    rental: (id: string) => ['history', 'rentals', id] as const,
    returns: ['history', 'returns'] as const,
    returnAttempt: (id: string) => ['history', 'returns', id] as const,
    settlements: ['history', 'settlements'] as const,
    settlement: (id: string) => ['history', 'settlements', id] as const,
    user: (id: string) => ['history', 'users', id] as const,
};

export function useRentals() {
    return useQuery({ queryKey: qk.rentals, queryFn: historyApi.rentals, retry: false });
}

export function useRental(id: string | undefined) {
    return useQuery({
        queryKey: qk.rental(id ?? ''),
        queryFn: () => historyApi.rental(id!),
        enabled: Boolean(id),
        retry: false,
    });
}

export function useReturns() {
    return useQuery({ queryKey: qk.returns, queryFn: historyApi.returns, retry: false });
}

export function useReturnAttempt(id: string | undefined) {
    return useQuery({
        queryKey: qk.returnAttempt(id ?? ''),
        queryFn: () => historyApi.returnAttempt(id!),
        enabled: Boolean(id),
        retry: false,
    });
}

export function useSettlements() {
    return useQuery({ queryKey: qk.settlements, queryFn: historyApi.settlements, retry: false });
}

export function useSettlement(id: string | undefined) {
    return useQuery({
        queryKey: qk.settlement(id ?? ''),
        queryFn: () => historyApi.settlement(id!),
        enabled: Boolean(id),
        retry: false,
    });
}

export function useUserHistory(userRef: string | undefined) {
    return useQuery({
        queryKey: qk.user(userRef ?? ''),
        queryFn: () => historyApi.user(userRef!),
        enabled: Boolean(userRef),
        retry: false,
    });
}
