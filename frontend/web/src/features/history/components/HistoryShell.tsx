import { NavLink } from 'react-router-dom';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { DateRangeFilter } from '@/features/history/components/DateRangeFilter';
import type { DateRange, PeriodPreset } from '@/features/history/lib/dateRange';
import { FilterSelect, type FilterOption } from '@/shared/components/FilterSelect';
import { SearchInput } from '@/shared/components/SearchInput';
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
    period: PeriodPreset;
    onPeriodChange: (value: PeriodPreset) => void;
    /** 지금 적용된 조회 범위. 사용자 지정일 때 달력 두 칸에 들어갑니다. */
    range: DateRange;
    onCustomRangeChange: (next: DateRange) => void;
    /** 달력이 미래를 못 고르게 막는 기준일 `YYYY-MM-DD` */
    maxDay: string;
    status: S;
    onStatusChange: (value: S) => void;
    statusOptions: readonly FilterOption<S>[];
    /** URL 에 확정된 검색어. 입력 중인 값이 아니라 조회에 실제로 쓰인 값입니다. */
    keyword: string;
    /** '조회' 를 눌렀을 때 확정할 검색어. */
    onSearch: (keyword: string) => void;
    keywordPlaceholder: string;
}

/**
 * 기간 · 상태 · 검색 · 조회. 확정된 조회 조건은 URL Query 에만 둡니다 (§6.2).
 *
 * **드롭다운은 고르는 즉시, 검색어는 `조회` 를 눌러야 확정됩니다.** 예전에는 검색어도
 * 글자마다 URL 에 바로 썼는데, `setSearchParams` 가 기록을 쌓아서 다섯 글자를 치면
 * 히스토리가 다섯 칸 늘었습니다. 뒤로가기를 누르면 한 글자씩 되돌아갔습니다.
 * 그래서 입력 중인 값은 이 컴포넌트가 들고 있다가 제출할 때 한 번만 올립니다.
 */
export function HistoryFilters<S extends string>({
    period,
    onPeriodChange,
    range,
    onCustomRangeChange,
    maxDay,
    status,
    onStatusChange,
    statusOptions,
    keyword,
    onSearch,
    keywordPlaceholder,
}: HistoryFiltersProps<S>) {
    const [input, setInput] = useState(keyword);

    // 뒤로가기·주소 직접 입력으로 URL 이 바뀌면 입력칸도 따라가야 합니다.
    useEffect(() => {
        setInput(keyword);
    }, [keyword]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        onSearch(input.trim());
    };

    return (
        <form onSubmit={submit} className="mb-[20px] flex items-center gap-3">
            <DateRangeFilter
                period={period}
                onPeriodChange={onPeriodChange}
                range={range}
                onCustomChange={onCustomRangeChange}
                maxDay={maxDay}
            />
            <FilterSelect
                label="상태 필터"
                value={status}
                onChange={onStatusChange}
                options={statusOptions}
                className="w-[140px]"
            />
            <SearchInput
                label="검색"
                placeholder={keywordPlaceholder}
                value={input}
                onChange={setInput}
                // 지우기는 입력과 조회를 함께 비웁니다. 입력만 비우면 주소에 검색어가
                // 남아 목록이 그대로여서, 지웠는데 결과가 안 바뀌는 것처럼 보입니다.
                onClear={() => {
                    setInput('');
                    onSearch('');
                }}
                className="w-[280px]"
            />
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
