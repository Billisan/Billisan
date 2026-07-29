import { useMemo, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { DetailLink } from '@/features/stations/components/DetailLink';
import {
    HistoryFilters,
    HistoryTabs,
    ListFooter,
    StatStrip,
} from '@/features/history/components/HistoryShell';
import {
    HISTORY_SYNCED_AT,
    MOCK_RENTALS,
    RENTAL_LIST_NOTE,
} from '@/features/history/mocks/history';
import {
    RENTAL_STATUS_LABEL,
    RENTAL_STATUS_TONE,
    type RentalDisplayStatus,
} from '@/features/history/types';
import { Badge } from '@/shared/components/Badge';
import { PageBar } from '@/shared/components/PageBar';
import { Pagination } from '@/shared/components/Pagination';
import type { FilterOption } from '@/shared/components/FilterSelect';
import { cn } from '@/lib/utils';

/**
 * 대여 이력 목록 — `SCR-WEB-RENTAL-LIST-001` (**P1**, `WEB-API-CAND-002`).
 *
 * 확정 API 가 없습니다. 아래 필드·조회 조건은 전부 잠정값입니다 (API명세 PART C).
 * 집계 카드의 `연체` 는 `dueAt` 과 현재 시각·정산 상태에서 파생하며
 * 신규 `RentalStatus` 를 추가하지 않습니다 (§8.1).
 */

const PERIOD_OPTIONS: readonly FilterOption<string>[] = [
    { value: '30D', label: '기간: 07.01 ~ 07.24' },
    { value: '7D', label: '기간: 최근 7일' },
    { value: 'TODAY', label: '기간: 오늘' },
];

type StatusFilter = 'ALL' | RentalDisplayStatus;

const STATUS_OPTIONS: readonly FilterOption<StatusFilter>[] = [
    { value: 'ALL', label: '상태 · 전체' },
    { value: 'ACTIVE', label: '대여중' },
    { value: 'OVERDUE', label: '연체' },
    { value: 'RETURNED', label: '반납완료' },
    { value: 'LOST', label: '분실' },
];

const PAGE_SIZE = 7;
const COLS = 'grid-cols-[143px_124px_153px_308px_146px_1fr]';

export function RentalListPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const period = searchParams.get('period') ?? '30D';
    const status = (searchParams.get('status') ?? 'ALL') as StatusFilter;
    const keyword = searchParams.get('q')?.trim() ?? '';
    const page = Math.max(1, Number(searchParams.get('page')) || 1);

    const rows = useMemo(() => {
        const normalized = keyword.toLowerCase();
        return MOCK_RENTALS.filter((rental) => {
            const matchesStatus = status === 'ALL' || rental.status === status;
            const matchesKeyword =
                !normalized ||
                rental.rentalId.toLowerCase().includes(normalized) ||
                rental.userRef.toLowerCase().includes(normalized);
            return matchesStatus && matchesKeyword;
        });
    }, [status, keyword]);

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const visible = rows.slice(start, start + PAGE_SIZE);

    const counts = useMemo(
        () => ({
            active: MOCK_RENTALS.filter((item) => item.status === 'ACTIVE').length,
            overdue: MOCK_RENTALS.filter((item) => item.status === 'OVERDUE').length,
            lost: MOCK_RENTALS.filter((item) => item.status === 'LOST').length,
        }),
        [],
    );

    const patch = (next: Record<string, string>) => {
        const params = new URLSearchParams(searchParams);
        Object.entries(next).forEach(([key, value]) => {
            if (!value || value === 'ALL' || value === '30D' || value === '1') params.delete(key);
            else params.set(key, value);
        });
        setSearchParams(params);
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        patch({ page: '1' });
    };

    return (
        <div>
            <PageBar className="mb-6" meta={`${HISTORY_SYNCED_AT} 기준`} />
            <HistoryTabs />

            <HistoryFilters
                period={period}
                onPeriodChange={(value) => patch({ period: value, page: '1' })}
                periodOptions={PERIOD_OPTIONS}
                status={status}
                onStatusChange={(value) => patch({ status: value, page: '1' })}
                statusOptions={STATUS_OPTIONS}
                keyword={keyword}
                onKeywordChange={(value) => patch({ q: value })}
                keywordPlaceholder="사용자 · 대여ID(R-) 검색"
                onSubmit={handleSubmit}
            />

            <StatStrip
                items={[
                    { label: '대여 중', value: `${counts.active}건` },
                    { label: '연체', value: `${counts.overdue}건`, tone: 'amber' },
                    { label: '분실', value: `${counts.lost}건`, tone: 'red' },
                ]}
            />

            <div className="overflow-hidden rounded-lg bg-white">
                <div
                    className={cn(
                        'grid h-[42px] items-center bg-brand-surface pl-[14px] pr-[14px] text-[11.5px] font-bold text-brand-body',
                        COLS,
                    )}
                >
                    <span>대여 시각</span>
                    <span>사용자</span>
                    <span>대여 ID</span>
                    <span>대여 위치</span>
                    <span>대여 상태</span>
                    <span className="text-center">상세</span>
                </div>

                {visible.length > 0 ? (
                    visible.map((rental, index) => (
                        <div
                            key={rental.rentalId}
                            className={cn(
                                'relative grid h-[42px] items-center pl-[14px] pr-[14px] text-[12.5px]',
                                COLS,
                            )}
                        >
                            {index > 0 && (
                                <span
                                    className="absolute inset-x-[14px] top-0 h-px bg-brand-line-soft"
                                    aria-hidden
                                />
                            )}
                            <span className="font-medium tabular-nums text-brand-ink-soft">
                                {rental.rentedAt.slice(5)}
                            </span>
                            <span className="font-medium text-brand-ink-soft">
                                {rental.userRef}
                            </span>
                            <span className="font-bold text-brand-ink">{rental.rentalId}</span>
                            <span className="truncate font-medium text-brand-ink-soft">
                                {rental.stationName}
                                <span className="ml-[6px] text-[11.5px] text-brand-muted">
                                    {rental.slotId}
                                </span>
                            </span>
                            <span>
                                <Badge tone={RENTAL_STATUS_TONE[rental.status]}>
                                    {RENTAL_STATUS_LABEL[rental.status]}
                                </Badge>
                            </span>
                            <span className="flex justify-center">
                                <DetailLink to={`/history/rentals/${rental.rentalId}`} />
                            </span>
                        </div>
                    ))
                ) : (
                    <div className="flex h-[200px] items-center justify-center text-[13px] font-medium text-brand-muted">
                        조건에 맞는 대여가 없습니다.
                    </div>
                )}
            </div>

            <ListFooter
                summary={`전체 ${rows.length}건 · ${start + 1}–${start + visible.length} 표시`}
            >
                <Pagination
                    page={currentPage}
                    totalPages={totalPages}
                    onChange={(next) => patch({ page: String(next) })}
                />
            </ListFooter>

            <p className="mt-[18px] text-[11.5px] font-medium leading-[18px] text-brand-muted">
                {RENTAL_LIST_NOTE}
            </p>
        </div>
    );
}
