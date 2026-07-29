import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { PropsWithChildren } from 'react';

import { env } from '@/config/env';
import { queryClient } from '@/lib/queryClient';

/**
 * 전역 프로바이더 묶음.
 * 여기에 테마/토스트 등 앱 전역 컨텍스트를 추가하세요.
 */
export function AppProviders({ children }: PropsWithChildren) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {/* 개발 모드 전용. 기본 위치(우측 하단)는 표의 페이지네이션을 가려서 좌측 하단으로 옮깁니다. */}
            {env.isDev && <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />}
        </QueryClientProvider>
    );
}
