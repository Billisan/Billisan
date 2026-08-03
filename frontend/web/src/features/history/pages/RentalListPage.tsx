import { shortId } from '@/shared/lib/shortId';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { DetailLink } from '@/features/stations/components/DetailLink';
import {
    DEFAULT_PERIOD,
    parsePeriod,
    resolveRange,
    withinRange,
} from '@/features/history/lib/dateRange';
import {
    HistoryFilters,
    HistoryTabs,
    ListFooter,
    StatStrip,
} from '@/features/history/components/HistoryShell';
import { HISTORY_SYNCED_AT, RENTAL_LIST_NOTE } from '@/features/history/mocks/history';
import {
    RENTAL_STATUS_LABEL,
    RENTAL_STATUS_TONE,
    rentalDisplayStatus,
    type RentalDisplayStatus,
} from '@/features/history/types';
import { Badge } from '@/shared/components/Badge';
import { useRentals } from '@/features/history/hooks/useHistory';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/PageState';
import { PageBar } from '@/shared/components/PageBar';
import { mockSyncedAt, syncedAtLabel } from '@/shared/lib/syncedAt';
import { PageTitle } from '@/shared/components/PageTitle';
import { RefId } from '@/shared/components/RefId';
import { ROW_CLICKABLE, useRowNavigate } from '@/shared/hooks/useRowNavigate';
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

type StatusFilter = 'ALL' | RentalDisplayStatus;

/*
 * 값은 서버 Enum(`RentalStatus`) 그대로 보내고, `연체` 만 예외입니다.
 * 연체는 DB 상태가 아니라 `dueAt` 에서 파생하는 표시라 클라이언트에서 거릅니다
 * (화면흐름 §8.1 "신규 RentalStatus 를 추가하지 않는다").
 * `REQUESTED`·`RETURNING`·`CANCELLED`·`FAILED` 는 관리자가 걸러 볼 일이 드물어 뺐습니다.
 * 필요해지면 줄만 더하면 됩니다 — 라벨은 이미 `RENTAL_STATUS_LABEL` 에 다 있습니다.
 */
const STATUS_OPTIONS: readonly FilterOption<StatusFilter>[] = [
    { value: 'ALL', label: '전체' },
    { value: 'ACTIVE', label: RENTAL_STATUS_LABEL.ACTIVE },
    { value: 'OVERDUE', label: RENTAL_STATUS_LABEL.OVERDUE },
    { value: 'COMPLETED', label: RENTAL_STATUS_LABEL.COMPLETED },
    { value: 'LOST', label: RENTAL_STATUS_LABEL.LOST },
];

const PAGE_SIZE = 7;
const COLS = 'grid-cols-[143px_124px_153px_308px_146px_1fr]';

export function RentalListPage() {
    // 확정 API 가 없어 목업이 뒤에 있습니다. 화면은 그 사실을 모릅니다.
    const query = useRentals();
    // ?? [] 를 그대로 두면 매 렌더 새 배열이라 아래 useMemo 가 매번 다시 돕니다.
    const rentals = useMemo(() => query.data ?? [], [query.data]);

    const [searchParams, setSearchParams] = useSearchParams();
    // 행 아무 데나 눌러도 상세로 (재고·대여소 표와 같은 규칙)
    const rowNavigate = useRowNavigate();
    const period = parsePeriod(searchParams.get('period'));
    /*
     * 지금 적용된 조회 범위. 사용자 지정일 때만 `from`·`to` 를 읽고, 프리셋이면
     * 기준일에서 계산합니다.
     *
     * `useMemo` 로 감싸는 건 아래 목록 필터가 이 값을 의존성으로 쓰기 때문입니다.
     * 매 렌더마다 새 객체가 나오면 목록이 늘 다시 걸러집니다.
     */
    const customFrom = searchParams.get('from') ?? undefined;
    const customTo = searchParams.get('to') ?? undefined;
    const range = useMemo(
        () => resolveRange(period, HISTORY_SYNCED_AT, { from: customFrom, to: customTo }),
        [period, customFrom, customTo],
    );
    const status = (searchParams.get('status') ?? 'ALL') as StatusFilter;
    const keyword = searchParams.get('q')?.trim() ?? '';
    const page = Math.max(1, Number(searchParams.get('page')) || 1);

    const rows = useMemo(() => {
        const normalized = keyword.toLowerCase();
        return rentals.filter((rental) => {
            const matchesStatus =
                status === 'ALL' || rentalDisplayStatus(rental, HISTORY_SYNCED_AT) === status;
            const matchesKeyword =
                !normalized ||
                rental.rentalId.toLowerCase().includes(normalized) ||
                rental.userRef.toLowerCase().includes(normalized);
            // 대여 시각 기준입니다. 조회 기간은 '언제 빌려 갔나' 를 묻는 것입니다.
            const matchesPeriod = withinRange(rental.rentedAt, range);
            return matchesPeriod && matchesStatus && matchesKeyword;
        });
    }, [status, keyword, rentals, range]);

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const visible = rows.slice(start, start + PAGE_SIZE);

    // 목록 전체의 파생 상태. 집계 카드가 이걸 셉니다.
    const byDisplay = useMemo(
        () => rentals.map((item) => rentalDisplayStatus(item, HISTORY_SYNCED_AT)),
        [rentals],
    );

    const counts = useMemo(
        () => ({
            // 집계도 파생 상태 기준입니다. 연체는 `ACTIVE` 중 기한이 지난 건이라
            // 서버 `status` 로 세면 '대여 중'에 섞여 들어갑니다 (화면흐름 §8.1).
            active: byDisplay.filter((item) => item === 'ACTIVE').length,
            overdue: byDisplay.filter((item) => item === 'OVERDUE').length,
            lost: byDisplay.filter((item) => item === 'LOST').length,
        }),
        [byDisplay],
    );

    const patch = (next: Record<string, string>) => {
        const params = new URLSearchParams(searchParams);
        Object.entries(next).forEach(([key, value]) => {
            if (!value || value === 'ALL' || value === '30D' || value === '1') params.delete(key);
            else params.set(key, value);
        });
        setSearchParams(params);
    };

    /*
     * 기간은 늘 걸려 있는 조건이라(기본 30일) 이것만으로는 '필터 중'으로 보지 않습니다.
     * 기본값에서 벗어난 것만 셉니다.
     */
    const hasFilter = period !== DEFAULT_PERIOD || status !== 'ALL' || keyword !== '';
    const resetFilters = () =>
        patch({ period: DEFAULT_PERIOD, status: 'ALL', q: '', from: '', to: '', page: '1' });

    return (
        <div>
            <PageBar
                className="mb-[18px]"
                meta={syncedAtLabel(mockSyncedAt(HISTORY_SYNCED_AT), query.dataUpdatedAt)}
            />
            {/* 탭이 제목 역할을 해서 화면에는 안 보이지만, 제목은 있어야 합니다. */}
            <PageTitle visuallyHidden>대여 이력</PageTitle>
            <HistoryTabs />

            <HistoryFilters
                period={period}
                onPeriodChange={(value) => patch({ period: value, page: '1' })}
                range={range}
                onCustomRangeChange={(next) =>
                    patch({ period: 'CUSTOM', from: next.from, to: next.to, page: '1' })
                }
                maxDay={HISTORY_SYNCED_AT.slice(0, 10)}
                status={status}
                onStatusChange={(value) => patch({ status: value, page: '1' })}
                statusOptions={STATUS_OPTIONS}
                keyword={keyword}
                onSearch={(value) => patch({ q: value, page: '1' })}
                keywordPlaceholder="사용자 · 대여 ID 검색"
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
                    {/*
                     * 배지가 든 열은 제목과 내용을 함께 가운데로 둡니다. 색 네모는 폭이
                     * 글자마다 달라서 왼쪽에 붙이면 줄마다 시작점이 어긋나 보입니다.
                     * `DataTable` 을 쓰는 표(슬롯·검수)는 원래 `align="center"` 였고
                     * 격자 목록만 왼쪽이라 어긋나 있었습니다.
                     */}
                    <span className="text-center">대여 상태</span>
                    {/* 화면에는 안 보이지만 열 이름은 있어야 합니다 — 스크린리더가 읽습니다. */}
                    <span className="sr-only">상세 보기</span>
                </div>

                {visible.length > 0 ? (
                    visible.map((rental, index) => {
                        // 배지에 찍을 상태. 대여 중인데 기한이 지났으면 '연체'가 됩니다.
                        const display = rentalDisplayStatus(rental, HISTORY_SYNCED_AT);

                        return (
                            <div
                                key={rental.rentalId}
                                onClick={rowNavigate(`/history/rentals/${rental.rentalId}`)}
                                className={cn(
                                    'relative grid h-[42px] items-center pl-[14px] pr-[14px] text-[12.5px]',
                                    ROW_CLICKABLE,
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
                                    {shortId(rental.userRef)}
                                </span>
                                <RefId id={rental.rentalId} label="대여 ID" />
                                <span className="truncate font-medium text-brand-ink-soft">
                                    {rental.stationName}
                                    <span className="ml-[6px] text-[11.5px] text-brand-muted">
                                        {rental.slotLabel}
                                    </span>
                                </span>
                                <span className="flex justify-center">
                                    <Badge tone={RENTAL_STATUS_TONE[display]}>
                                        {RENTAL_STATUS_LABEL[display]}
                                    </Badge>
                                </span>
                                <span className="flex justify-center">
                                    <DetailLink to={`/history/rentals/${rental.rentalId}`} />
                                </span>
                            </div>
                        );
                    })
                ) : query.isPending ? (
                    <LoadingState />
                ) : query.isError ? (
                    <ErrorState error={query.error} onRetry={() => query.refetch()} />
                ) : (
                    /*
                     * 조건 때문에 0건인 것과 데이터가 아예 없는 것을 갈라 말합니다.
                     * 필터를 걸어 둔 걸 잊으면 "대여 이력이 없다" 로 읽힙니다.
                     */
                    <EmptyState filtered={hasFilter} onReset={resetFilters}>
                        {hasFilter
                            ? '조회 조건에 맞는 대여 이력이 없습니다.'
                            : '대여 이력이 없습니다.'}
                    </EmptyState>
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
