import { useMemo, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { DetailLink } from '@/features/stations/components/DetailLink';
import {
    HistoryFilters,
    HistoryTabs,
    ListFooter,
    StatStrip,
} from '@/features/history/components/HistoryShell';
import { HISTORY_SYNCED_AT } from '@/features/history/mocks/history';
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
import { ErrorState, LoadingState } from '@/shared/components/PageState';
import { PageBar } from '@/shared/components/PageBar';
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

const PERIOD_OPTIONS: readonly FilterOption<string>[] = [
    { value: '30D', label: '기간: 07.01 ~ 07.24' },
    { value: '7D', label: '기간: 최근 7일' },
    { value: 'TODAY', label: '기간: 오늘' },
];

type StatusFilter = 'ALL' | SettlementStatus;

const STATUS_OPTIONS: readonly FilterOption<StatusFilter>[] = [
    { value: 'ALL', label: '상태 · 전체' },
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
    const period = searchParams.get('period') ?? '30D';
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
            return matchesStatus && matchesKeyword;
        });
    }, [status, keyword, settlements]);

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
                keywordPlaceholder="사용자 · 정산ID(S-) 검색"
                onSubmit={handleSubmit}
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
                    <span>정산 상태</span>
                    <span className="text-center">상세</span>
                </div>

                {visible.length > 0 ? (
                    visible.map((item, index) => (
                        <div
                            key={item.settlementId}
                            className={cn(
                                'relative grid h-[51px] items-center px-[14px] text-[12.5px]',
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
                            <span className="font-medium text-brand-ink-soft">{item.userRef}</span>
                            <span className="font-bold text-brand-ink">{item.settlementId}</span>
                            <span className="flex items-center gap-[10px]">
                                <Badge tone={SETTLEMENT_REASON_TONE[item.reason]}>
                                    {SETTLEMENT_REASON_LABEL[item.reason]}
                                </Badge>
                                <span className="font-bold tabular-nums text-brand-ink">
                                    {formatWon(item.amount)}
                                </span>
                            </span>
                            <span>
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
                    <div className="flex h-[200px] items-center justify-center text-[13px] font-medium text-brand-muted">
                        조건에 맞는 정산이 없습니다.
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
                대여 건당 정산 행은 하나입니다. 우선순위는 파손 &gt; 분실 &gt; 연체이고 상한은
                7,000원이며, 상위 사유로 총액이 올라가도 이미 결제된 금액은 보존됩니다 (§11.1).
            </p>
        </div>
    );
}
