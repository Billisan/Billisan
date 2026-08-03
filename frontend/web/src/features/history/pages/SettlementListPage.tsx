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
import {
    formatWon,
    outstandingOf,
    SETTLEMENT_REASON_LABEL,
    SETTLEMENT_REASON_TONE,
    SETTLEMENT_STATUS_LABEL,
    SETTLEMENT_STATUS_TONE,
    type SettlementStatus,
} from '@/features/history/types';
import { Badge } from '@/shared/components/Badge';
import { useSettlements } from '@/features/history/hooks/useHistory';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/PageState';
import { PageBar } from '@/shared/components/PageBar';
import { HISTORY_SYNCED_AT } from '@/features/history/mocks/history';
import { mockSyncedAt, syncedAtLabel } from '@/shared/lib/syncedAt';
import { PageTitle } from '@/shared/components/PageTitle';
import { RefId } from '@/shared/components/RefId';
import { ROW_CLICKABLE, useRowNavigate } from '@/shared/hooks/useRowNavigate';
import { Pagination } from '@/shared/components/Pagination';
import type { FilterOption } from '@/shared/components/FilterSelect';
import { cn } from '@/lib/utils';

/**
 * 정산 이력 목록 — `SCR-WEB-SETTLEMENT-LIST-001` (**P1**, `WEB-API-CAND-006`).
 *
 * 정책(§11.1): 대여별 단일 정산 행, 우선순위 `DAMAGE > LOSS > OVERDUE`,
 * 대여 건당 상한 7,000원, 사유별 금액 합산 금지, `outstandingAmount = amount - paidAmount`.
 * 금액은 서버 값을 그대로 씁니다. 클라이언트가 권위값으로 재계산하지 않습니다 (§17).
 */

type StatusFilter = 'ALL' | SettlementStatus;

const STATUS_OPTIONS: readonly FilterOption<StatusFilter>[] = [
    { value: 'ALL', label: '전체' },
    { value: 'PENDING', label: '미정산' },
    { value: 'PAID', label: '정산완료' },
    { value: 'CANCELLED', label: '취소' },
];

const PAGE_SIZE = 6;
const COLS = 'grid-cols-[153px_124px_144px_279px_164px_1fr]';

export function SettlementListPage() {
    // 확정 API 가 없어 목업이 뒤에 있습니다. 화면은 그 사실을 모릅니다.
    const query = useSettlements();
    // ?? [] 를 그대로 두면 매 렌더 새 배열이라 아래 useMemo 가 매번 다시 돕니다.
    const settlements = useMemo(() => query.data ?? [], [query.data]);

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
        return settlements.filter((item) => {
            const matchesStatus = status === 'ALL' || item.status === status;
            const matchesKeyword =
                !normalized ||
                item.settlementId.toLowerCase().includes(normalized) ||
                item.userRef.toLowerCase().includes(normalized);
            // 정산 발생 시각 기준입니다. 납부 시각이 아니라 청구가 생긴 때입니다.
            const matchesPeriod = withinRange(item.createdAt, range);
            return matchesPeriod && matchesStatus && matchesKeyword;
        });
    }, [status, keyword, settlements, range]);

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const visible = rows.slice(start, start + PAGE_SIZE);

    const summary = useMemo(() => {
        const pending = settlements.filter((item) => item.status === 'PENDING');
        const paid = settlements.filter((item) => item.status === 'PAID');
        return {
            pendingCount: pending.length,
            pendingAmount: pending.reduce((sum, item) => sum + outstandingOf(item), 0),
            paidCount: paid.length,
            paidAmount: paid.reduce((sum, item) => sum + item.paidAmount, 0),
        };
    }, [settlements]);

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
            <PageTitle visuallyHidden>정산 이력</PageTitle>
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
                keywordPlaceholder="사용자 · 정산 ID 검색"
            />

            <StatStrip
                items={[
                    {
                        label: '미정산',
                        value: `${summary.pendingCount}건 · ${formatWon(summary.pendingAmount)}`,
                        tone: 'red',
                    },
                    {
                        label: '정산완료',
                        value: `${summary.paidCount}건 · ${formatWon(summary.paidAmount)}`,
                        tone: 'green',
                    },
                ]}
            />

            <div className="overflow-hidden rounded-lg bg-white">
                <div
                    className={cn(
                        'grid h-[42px] items-center bg-brand-surface px-[14px] text-[11.5px] font-bold text-brand-body',
                        COLS,
                    )}
                >
                    <span>일시</span>
                    <span>사용자</span>
                    <span>정산 ID</span>
                    <span>정산 유형 · 금액</span>
                    {/*
                     * 배지가 든 열은 제목과 내용을 함께 가운데로 둡니다. 색 네모는 폭이
                     * 글자마다 달라서 왼쪽에 붙이면 줄마다 시작점이 어긋나 보입니다.
                     * `DataTable` 을 쓰는 표(슬롯·검수)는 원래 `align="center"` 였고
                     * 격자 목록만 왼쪽이라 어긋나 있었습니다.
                     */}
                    <span className="text-center">정산 상태</span>
                    <span className="sr-only">상세 보기</span>
                </div>

                {visible.length > 0 ? (
                    visible.map((item, index) => (
                        <div
                            key={item.settlementId}
                            onClick={rowNavigate(`/history/settlements/${item.settlementId}`)}
                            className={cn(
                                'relative grid h-[51px] items-center px-[14px] text-[12.5px]',
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
                                {item.createdAt.slice(5)}
                            </span>
                            <span className="font-medium text-brand-ink-soft">
                                {shortId(item.userRef)}
                            </span>
                            <RefId id={item.settlementId} label="정산 ID" />
                            <span className="flex items-center gap-[10px]">
                                <Badge tone={SETTLEMENT_REASON_TONE[item.reason]}>
                                    {SETTLEMENT_REASON_LABEL[item.reason]}
                                </Badge>
                                <span className="font-bold tabular-nums text-brand-ink">
                                    {formatWon(item.amount)}
                                </span>
                            </span>
                            <span className="flex justify-center">
                                <Badge tone={SETTLEMENT_STATUS_TONE[item.status]}>
                                    {SETTLEMENT_STATUS_LABEL[item.status]}
                                </Badge>
                            </span>
                            <span className="flex justify-center">
                                <DetailLink to={`/history/settlements/${item.settlementId}`} />
                            </span>
                        </div>
                    ))
                ) : query.isPending ? (
                    <LoadingState />
                ) : query.isError ? (
                    <ErrorState error={query.error} onRetry={() => query.refetch()} />
                ) : (
                    /*
                     * 조건 때문에 0건인 것과 데이터가 아예 없는 것을 갈라 말합니다.
                     * 필터를 걸어 둔 걸 잊으면 "정산 이력이 없다" 로 읽힙니다.
                     */
                    <EmptyState filtered={hasFilter} onReset={resetFilters}>
                        {hasFilter
                            ? '조회 조건에 맞는 정산 이력이 없습니다.'
                            : '정산 이력이 없습니다.'}
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
                대여 건당 정산 행은 하나입니다. 우선순위는 파손 &gt; 분실 &gt; 연체이고 상한은
                7,000원이며, 상위 사유로 총액이 올라가도 이미 결제된 금액은 보존됩니다 (§11.1).
            </p>
        </div>
    );
}
