import { cn } from '@/lib/utils';

interface PaginationProps {
    /** 1-based 현재 페이지 */
    page: number;
    totalPages: number;
    onChange: (page: number) => void;
    className?: string;
}

/** 한 번에 보여줄 숫자 칸 수. 시안은 `‹ 1 2 3 4 5 … 44 ›` 형태입니다. */
const WINDOW = 5;

/**
 * 서버 계약은 cursor 우선이고 숫자 페이지는 프런트 표시로만 씁니다
 * (화면흐름 WF-WEB-CHANGE-010). 그래서 이 창(window) 계산은 UI 표현일 뿐입니다.
 */
function buildPages(page: number, totalPages: number): (number | 'gap')[] {
    if (totalPages <= WINDOW + 2) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (page <= WINDOW - 1) {
        return [...Array.from({ length: WINDOW }, (_, i) => i + 1), 'gap', totalPages];
    }
    if (page >= totalPages - (WINDOW - 2)) {
        return [1, 'gap', ...Array.from({ length: WINDOW }, (_, i) => totalPages - WINDOW + 1 + i)];
    }
    return [1, 'gap', page - 1, page, page + 1, 'gap', totalPages];
}

function Chevron({ direction }: { direction: 'prev' | 'next' }) {
    return (
        <svg viewBox="-0.9 -0.9 8.6 11.8" width="8.6" height="11.8" aria-hidden>
            <path
                d={direction === 'prev' ? 'M6.8 0 L0 5 L6.8 10' : 'M0 0 L6.8 5 L0 10'}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

/** 숫자 칸 형태의 페이지네이션. 페이지가 1개뿐이어도 시안대로 칸 하나를 노출합니다. */
export function Pagination({ page, totalPages, onChange, className }: PaginationProps) {
    const total = Math.max(1, totalPages);
    const items = buildPages(page, total);

    const arrowClass =
        'flex size-[30px] items-center justify-center rounded-[7px] border border-brand-border-soft bg-white text-brand-body transition-colors hover:bg-brand-surface disabled:cursor-not-allowed disabled:opacity-40';

    return (
        <nav className={cn('flex items-center gap-2', className)} aria-label="페이지 이동">
            <button
                type="button"
                onClick={() => onChange(page - 1)}
                disabled={page <= 1}
                className={arrowClass}
            >
                <span className="sr-only">이전 페이지</span>
                <Chevron direction="prev" />
            </button>

            {items.map((item, index) =>
                item === 'gap' ? (
                    <span
                        key={`gap-${index}`}
                        className="flex w-5 justify-center text-[13px] font-bold text-brand-muted"
                        aria-hidden
                    >
                        …
                    </span>
                ) : (
                    <button
                        key={item}
                        type="button"
                        onClick={() => onChange(item)}
                        aria-current={item === page ? 'page' : undefined}
                        className={cn(
                            // 두 자리 이상이면 시안처럼 칸이 옆으로 늘어납니다 (44 → 36px).
                            'flex h-[30px] min-w-[30px] items-center justify-center rounded-[7px] px-[7px] text-xs transition-colors',
                            item === page
                                ? 'bg-tone-blue-bg font-bold text-tone-blue-fg'
                                : 'border border-brand-border-soft bg-white font-medium text-brand-body hover:bg-brand-surface',
                        )}
                    >
                        {item}
                    </button>
                ),
            )}

            <button
                type="button"
                onClick={() => onChange(page + 1)}
                disabled={page >= total}
                className={arrowClass}
            >
                <span className="sr-only">다음 페이지</span>
                <Chevron direction="next" />
            </button>
        </nav>
    );
}
