import { shortId } from '@/shared/lib/shortId';
import { useMemo } from 'react';
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
    RETURN_STATUS_LABEL,
    RETURN_STATUS_TONE,
    REVIEW_STATUS_LABEL,
    REVIEW_STATUS_TONE,
} from '@/features/history/types';
import { Badge } from '@/shared/components/Badge';
import { useReturns } from '@/features/history/hooks/useHistory';
import { ErrorState, LoadingState } from '@/shared/components/PageState';
import { PageBar } from '@/shared/components/PageBar';
import { PageTitle } from '@/shared/components/PageTitle';
import { RefId } from '@/shared/components/RefId';
import { ROW_CLICKABLE, useRowNavigate } from '@/shared/hooks/useRowNavigate';
import { Pagination } from '@/shared/components/Pagination';
import type { FilterOption } from '@/shared/components/FilterSelect';
import { cn } from '@/lib/utils';

/**
 * 반납 이력 목록 — `SCR-WEB-RETURN-LIST-001` (**P1**, `WEB-API-CAND-004`).
 *
 * 표에 이미지 관련 열을 두지 않습니다. `촬영 이미지 있음` 은 `GAP-WEB-002` 로
 * `SECURITY_REJECTED` 이고, 이미지 존재 Boolean 자체를 API 에 요구하지 않습니다.
 */

const PERIOD_OPTIONS: readonly FilterOption<string>[] = [
    { value: '30D', label: '기간: 07.01 ~ 07.24' },
    { value: '7D', label: '기간: 최근 7일' },
    { value: 'TODAY', label: '기간: 오늘' },
];

/*
 * 걸러 보는 축은 **검수 처리 상태**입니다.
 *
 * 화면흐름 §9.1 의 조회 조건은 `ReturnAttemptStatus`·AI 결과·관리자 처리 상태 셋 다지만,
 * 반납 상태는 실제로 거의 전부 `COMPLETED` 라 걸러도 남는 게 그대로입니다. 관리자가
 * 찾는 건 "아직 판정 안 한 것"이라 그 축을 드롭다운에 둡니다. 반납 상태는 옆 열에
 * 그대로 보이니 정보가 사라지지는 않습니다.
 *
 * TODO: 반납 상태·AI 결과 필터도 계약에 있습니다. 드롭다운을 더 붙이려면 HistoryFilters
 *       에 선택 축을 추가해야 해서 이력 3종을 함께 손봐야 합니다.
 */
type StatusFilter = 'ALL' | 'PENDING' | 'DECIDED' | 'NONE';

const STATUS_OPTIONS: readonly FilterOption<StatusFilter>[] = [
    { value: 'ALL', label: '검수 · 전체' },
    { value: 'PENDING', label: REVIEW_STATUS_LABEL.PENDING },
    { value: 'DECIDED', label: REVIEW_STATUS_LABEL.DECIDED },
    { value: 'NONE', label: '검수 없음' },
];

const PAGE_SIZE = 7;
const COLS = 'grid-cols-[140px_112px_150px_232px_112px_104px_1fr]';

export function ReturnListPage() {
    // 확정 API 가 없어 목업이 뒤에 있습니다. 화면은 그 사실을 모릅니다.
    const query = useReturns();
    // ?? [] 를 그대로 두면 매 렌더 새 배열이라 아래 useMemo 가 매번 다시 돕니다.
    const returns = useMemo(() => query.data ?? [], [query.data]);

    const [searchParams, setSearchParams] = useSearchParams();
    // 행 아무 데나 눌러도 상세로 (재고·대여소 표와 같은 규칙)
    const rowNavigate = useRowNavigate();
    const period = searchParams.get('period') ?? '30D';
    const status = (searchParams.get('status') ?? 'ALL') as StatusFilter;
    const keyword = searchParams.get('q')?.trim() ?? '';
    const page = Math.max(1, Number(searchParams.get('page')) || 1);

    const rows = useMemo(() => {
        const normalized = keyword.toLowerCase();
        return returns.filter((item) => {
            const matchesStatus =
                status === 'ALL' ||
                (status === 'NONE' ? item.reviewStatus === null : item.reviewStatus === status);
            const matchesKeyword =
                !normalized ||
                item.returnAttemptId.toLowerCase().includes(normalized) ||
                item.userRef.toLowerCase().includes(normalized);
            return matchesStatus && matchesKeyword;
        });
    }, [status, keyword, returns]);

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const visible = rows.slice(start, start + PAGE_SIZE);

    const pending = returns.filter((item) => item.reviewStatus === 'PENDING').length;
    const today = returns.filter((item) => item.attemptedAt.startsWith('2026-07-24')).length;

    const patch = (next: Record<string, string>) => {
        const params = new URLSearchParams(searchParams);
        Object.entries(next).forEach(([key, value]) => {
            if (!value || value === 'ALL' || value === '30D' || value === '1') params.delete(key);
            else params.set(key, value);
        });
        setSearchParams(params);
    };

    return (
        <div>
            <PageBar className="mb-[18px]" meta={`${HISTORY_SYNCED_AT} 기준`} />
            {/* 탭이 제목 역할을 해서 화면에는 안 보이지만, 제목은 있어야 합니다. */}
            <PageTitle visuallyHidden>반납 이력</PageTitle>
            <HistoryTabs />

            <HistoryFilters
                period={period}
                onPeriodChange={(value) => patch({ period: value, page: '1' })}
                periodOptions={PERIOD_OPTIONS}
                status={status}
                onStatusChange={(value) => patch({ status: value, page: '1' })}
                statusOptions={STATUS_OPTIONS}
                keyword={keyword}
                onSearch={(value) => patch({ q: value, page: '1' })}
                keywordPlaceholder="사용자 · 반납 ID 검색"
            />

            <StatStrip
                items={[
                    { label: '검수 대기', value: `${pending}건`, tone: 'amber' },
                    { label: '오늘 반납', value: `${today}건` },
                ]}
            />

            <div className="overflow-hidden rounded-lg bg-white">
                <div
                    className={cn(
                        'grid h-[42px] items-center bg-brand-surface px-[14px] text-[11.5px] font-bold text-brand-body',
                        COLS,
                    )}
                >
                    <span>반납 시각</span>
                    <span>사용자</span>
                    <span>반납 ID</span>
                    <span>반납 위치</span>
                    <span>반납 상태</span>
                    <span>관리자 검수</span>
                    <span className="text-center">상세</span>
                </div>

                {visible.length > 0 ? (
                    visible.map((item, index) => (
                        <div
                            key={item.returnAttemptId}
                            onClick={rowNavigate(`/history/returns/${item.returnAttemptId}`)}
                            className={cn(
                                'relative grid h-[44px] items-center px-[14px] text-[12.5px]',
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
                                {item.attemptedAt.slice(5)}
                            </span>
                            <span className="font-medium text-brand-ink-soft">
                                {shortId(item.userRef)}
                            </span>
                            <RefId id={item.returnAttemptId} label="반납 시도 ID" />
                            <span className="truncate font-medium text-brand-ink-soft">
                                {item.stationName}
                                <span className="ml-[6px] text-[11.5px] text-brand-muted">
                                    {item.slotId ?? '슬롯 미선정'}
                                </span>
                            </span>
                            <span>
                                <Badge tone={RETURN_STATUS_TONE[item.status]}>
                                    {RETURN_STATUS_LABEL[item.status]}
                                </Badge>
                            </span>
                            {/* 검수가 안 걸린 반납은 비웁니다 — AI 가 정상으로 본 건은 넘어오지 않습니다. */}
                            <span>
                                {item.reviewStatus ? (
                                    <Badge tone={REVIEW_STATUS_TONE[item.reviewStatus]}>
                                        {REVIEW_STATUS_LABEL[item.reviewStatus]}
                                    </Badge>
                                ) : (
                                    <span className="text-brand-muted">—</span>
                                )}
                            </span>
                            <span className="flex justify-center">
                                <DetailLink to={`/history/returns/${item.returnAttemptId}`} />
                            </span>
                        </div>
                    ))
                ) : query.isPending ? (
                    <LoadingState />
                ) : query.isError ? (
                    <ErrorState error={query.error} onRetry={() => query.refetch()} />
                ) : (
                    <div className="flex h-[200px] items-center justify-center text-[13px] font-medium text-brand-muted">
                        조건에 맞는 반납이 없습니다.
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
                반납 시도는 한 대여에 여러 건일 수 있습니다. 완료 시도는 최대 1건입니다 (§8.2). 원본
                촬영 이미지는 저장·조회하지 않으며 관리자 판정은 현장 실물로만 합니다.
            </p>
        </div>
    );
}
