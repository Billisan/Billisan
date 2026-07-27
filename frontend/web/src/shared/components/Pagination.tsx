import { cn } from '@/lib/utils';

interface PaginationProps {
    /** 1-based 현재 페이지 */
    page: number;
    totalPages: number;
    onChange: (page: number) => void;
    className?: string;
}

/** 숫자 칩 형태의 페이지네이션. 페이지가 1개뿐이어도 시안대로 칩 하나를 노출합니다. */
export function Pagination({ page, totalPages, onChange, className }: PaginationProps) {
    const pages = Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1);

    return (
        <nav className={cn('flex items-center gap-2', className)} aria-label="페이지 이동">
            {pages.map((n) => {
                const isCurrent = n === page;
                return (
                    <button
                        key={n}
                        type="button"
                        onClick={() => onChange(n)}
                        aria-current={isCurrent ? 'page' : undefined}
                        className={cn(
                            'flex size-[30px] items-center justify-center rounded-[7px] text-xs transition-colors',
                            isCurrent
                                ? 'bg-tone-blue-bg font-bold text-tone-blue-fg'
                                : 'border border-brand-border-soft bg-white font-medium text-brand-body hover:bg-brand-surface',
                        )}
                    >
                        {n}
                    </button>
                );
            })}
        </nav>
    );
}
