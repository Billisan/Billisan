import { QueryClient } from '@tanstack/react-query';

/**
 * 전역 TanStack Query 클라이언트.
 * 서버 상태 캐싱/재요청 정책의 기본값을 여기서 관리합니다.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000, // 1분
            retry: 1,
            refetchOnWindowFocus: false,
        },
        mutations: {
            retry: 0,
        },
    },
});
