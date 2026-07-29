import { Search } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { FormEvent, ReactNode } from 'react';

import { FilterSelect, type FilterOption } from '@/shared/components/FilterSelect';
import { cn } from '@/lib/utils';

/**
 * 대여·반납·정산 이력 목록이 공유하는 껍데기.
 *
 * 사이드바의 `이력` 은 세 탭을 공유하되 각 탭의 조회 조건과 상세 화면은 분리합니다 (화면흐름 §4).
 *
 * 시안에는 `조치 이력` 탭과 `CSV / XLSX` 버튼이 더 있는데 둘 다 뺐습니다.
 * - 조치 이력: `SCR-WEB-ACTION-HISTORY-001` 은 `DEFERRED_NOT_CONTRACTED` 입니다(§5 · §14 · DEC-WEB-005).
 * - 내보내기: `GAP-WEB-010` `OUT_OF_SCOPE 후보`, `DEC-WEB-006` 권장안이 `P2 제외` 입니다.
 */

const TABS = [
    { to: '/history/rentals', label: '대여 이력' },
    { to: '/history/returns', label: '반납 이력' },
    { to: '/history/settlements', label: '정산 이력' },
];

export function HistoryTabs() {
    return (
        <div className="mb-[18px] border-b border-brand-line-soft pl-[6px]">
            <nav className="flex items-end gap-[44px]" aria-label="이력 종류">
                {TABS.map((tab) => (
                    <NavLink
                        key={tab.to}
                        to={tab.to}
                        className={({ isActive }) =>
                            cn(
                                'border-b-[3px] px-2 pb-[10px] text-[13.5px] font-bold transition-colors',
                                isActive
                                    ? 'border-brand-blue text-brand-ink'
                                    : 'border-transparent text-brand-muted hover:text-brand-body',
                            )
                        }
                    >
                        {tab.label}
                    </NavLink>
                ))}
            </nav>
        </div>
    );
}

interface HistoryFiltersProps<S extends string> {
    period: string;
    onPeriodChange: (value: string) => void;
    periodOptions: readonly FilterOption<string>[];
    status: S;
    onStatusChange: (value: S) => void;
    statusOptions: readonly FilterOption<S>[];
    keyword: string;
    onKeywordChange: (value: string) => void;
    keywordPlaceholder: string;
    onSubmit: (event: FormEvent) => void;
}

/** 기간 · 상태 · 검색 · 조회. 확정된 조회 조건은 URL Query 에만 둡니다 (§6.2). */
export function HistoryFilters<S extends string>({
    period,
    onPeriodChange,
    periodOptions,
    status,
    onStatusChange,
    statusOptions,
    keyword,
    onKeywordChange,
    keywordPlaceholder,
    onSubmit,
}: HistoryFiltersProps<S>) {
    return (
        <form onSubmit={onSubmit} className="mb-[20px] flex items-center gap-3">
            <FilterSelect
                label="조회 기간"
                value={period}
                onChange={onPeriodChange}
                options={periodOptions}
                className="w-[190px]"
            />
            <FilterSelect
                label="상태 필터"
                value={status}
                onChange={onStatusChange}
                options={statusOptions}
                className="w-[140px]"
            />
            <label className="relative block">
                <span className="sr-only">검색</span>
                <Search
                    className="pointer-events-none absolute left-[14px] top-1/2 size-[13px] -translate-y-1/2 text-brand-muted"
                    aria-hidden
                />
                <input
                    value={keyword}
                    onChange={(event) => onKeywordChange(event.target.value)}
                    placeholder={keywordPlaceholder}
                    className="h-[38px] w-[280px] rounded-lg bg-brand-surface pl-[38px] pr-3 text-[12.5px] font-medium text-brand-ink outline-none transition-shadow placeholder:text-brand-muted focus-visible:ring-2 focus-visible:ring-brand-blue/40"
                />
            </label>
            <button
                type="submit"
                className="h-[38px] w-[74px] rounded-[7px] bg-brand-blue text-[13px] font-bold text-white transition-colors hover:bg-brand-blue/90"
            >
                조회
            </button>
        </form>
    );
}

export interface StatItem {
    label: string;
    value: string;
    tone?: 'ink' | 'amber' | 'red' | 'green';
}

const STAT_TONE = {
    ink: 'text-brand-ink',
    amber: 'text-tone-amber-fg',
    red: 'text-tone-red-fg',
    green: 'text-tone-green-fg',
} as const;

/**
 * 목록 위의 집계 띠. 시안 기준 높이 66px, 칸 사이 간격 14px.
 * 이 수치는 단일 컬럼이 아니라 집계 결과입니다 (§7.2 와 같은 성격).
 */
export function StatStrip({ items }: { items: StatItem[] }) {
    return (
        <div
            className="mb-4 grid gap-[14px]"
            style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
            {items.map((item) => (
                <div
                    key={item.label}
                    className="relative h-[66px] rounded-lg border border-brand-line-soft bg-white pl-5 pt-[13px]"
                >
                    <p className="text-[12px] font-medium text-brand-body">{item.label}</p>
                    <p
                        className={cn(
                            'mt-[6px] text-[17px] font-extrabold leading-none tabular-nums',
                            STAT_TONE[item.tone ?? 'ink'],
                        )}
                    >
                        {item.value}
                    </p>
                </div>
            ))}
        </div>
    );
}

/** 표 아래 요약 + 페이지네이션 줄. */
export function ListFooter({ summary, children }: { summary: string; children: ReactNode }) {
    return (
        <div className="mt-[22px] flex items-center justify-between pr-2">
            <p className="text-xs font-semibold text-brand-body">{summary}</p>
            {children}
        </div>
    );
}
