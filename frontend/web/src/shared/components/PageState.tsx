import type { ReactNode } from 'react';

import { ApiRequestError } from '@/lib/api-error';
import { cn } from '@/lib/utils';

/**
 * 목록·상세 자리에 들어가는 로딩·오류·빈 상태 한 벌.
 *
 * 화면마다 따로 만들면 문구와 높이가 제각각이 됩니다. 특히 **오류**는 그냥 빈 표로
 * 두면 "데이터가 없다"와 "불러오지 못했다"를 구분할 수 없습니다.
 */

function Frame({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                'flex h-[200px] flex-col items-center justify-center gap-[10px] rounded-lg bg-white px-6 text-center',
                className,
            )}
        >
            {children}
        </div>
    );
}

export function LoadingState({ label = '불러오는 중…' }: { label?: string }) {
    return (
        <Frame>
            {/* 스피너는 감속 설정을 존중합니다 (prefers-reduced-motion). */}
            <span
                className="size-[18px] animate-spin rounded-full border-2 border-brand-line border-t-brand-blue motion-reduce:animate-none"
                aria-hidden
            />
            <p className="text-[13px] font-medium text-brand-muted" role="status">
                {label}
            </p>
        </Frame>
    );
}

export function EmptyState({ children }: { children: ReactNode }) {
    return (
        <Frame>
            <p className="text-[13px] font-medium text-brand-muted">{children}</p>
        </Frame>
    );
}

/**
 * 조회 실패.
 *
 * 관리자 오류 10종은 전부 `retryable=false` 라 자동 재시도하지 않습니다. 대신 사람이
 * 직접 누를 수 있는 '다시 시도'를 둡니다. 서버 메시지를 그대로 보여주되 코드도 같이
 * 남겨서 백엔드 로그와 대조할 수 있게 합니다.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
    const message = error instanceof Error ? error.message : '데이터를 불러오지 못했습니다.';
    const code = error instanceof ApiRequestError ? error.code : undefined;

    return (
        <Frame>
            <p className="text-[13px] font-bold text-tone-red-fg" role="alert">
                불러오지 못했습니다
            </p>
            <p className="max-w-[420px] text-[12px] font-medium leading-[1.5] text-brand-muted">
                {message}
                {code && <span className="ml-[6px] font-mono text-[11px]">({code})</span>}
            </p>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-[4px] h-[32px] rounded-[7px] border border-brand-border-soft px-[14px] text-[12px] font-bold text-brand-body transition-colors hover:bg-brand-surface"
                >
                    다시 시도
                </button>
            )}
        </Frame>
    );
}
