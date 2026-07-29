import { useMemo, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { DetailLink } from '@/features/stations/components/DetailLink';
import {
    HistoryFilters,
    HistoryTabs,
    ListFooter,
    StatStrip,
} from '@/features/history/components/HistoryShell';
import { HISTORY_SYNCED_AT, MOCK_RETURNS } from '@/features/history/mocks/history';
import {
    RETURN_STATUS_LABEL,
    RETURN_STATUS_TONE,
    type ReturnDisplayStatus,
} from '@/features/history/types';
import { Badge } from '@/shared/components/Badge';
import { PageBar } from '@/shared/components/PageBar';
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

type StatusFilter = 'ALL' | ReturnDisplayStatus;

const STATUS_OPTIONS: readonly FilterOption<StatusFilter>[] = [
    { value: 'ALL', label: '상태 · 전체' },
    { value: 'REVIEW_PENDING', label: '검수 대기' },
    { value: 'REVIEW_DONE', label: '검수 완료' },
    { value: 'COMPLETED', label: '반납완료' },
    { value: 'RECOVERY', label: '복구 필요' },
];

const PAGE_SIZE = 7;
const COLS = 'grid-cols-[153px_124px_163px_298px_136px_1fr]';

export function ReturnListPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const period = searchParams.get('period') ?? '30D';
    const status = (searchParams.get('status') ?? 'ALL') as StatusFilter;
    const keyword = searchParams.get('q')?.trim() ?? '';
    const page = Math.max(1, Number(searchParams.get('page')) || 1);

    const rows = useMemo(() => {
        const normalized = keyword.toLowerCase();
        return MOCK_RETURNS.filter((item) => {
            const matchesStatus = status === 'ALL' || item.status === status;
            const matchesKeyword =
                !normalized ||
                item.returnAttemptId.toLowerCase().includes(normalized) ||
                item.userRef.toLowerCase().includes(normalized);
            return matchesStatus && matchesKeyword;
        });
    }, [status, keyword]);

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const visible = rows.slice(start, start + PAGE_SIZE);

    const pending = MOCK_RETURNS.filter((item) => item.status === 'REVIEW_PENDING').length;
    const today = MOCK_RETURNS.filter((item) => item.attemptedAt.startsWith('2026-07-24')).length;

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
                keywordPlaceholder="사용자 · 반납ID(RT-) 검색"
                onSubmit={handleSubmit}
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
                    <span>반납 처리</span>
                    <span className="text-center">상세</span>
                </div>

                {visible.length > 0 ? (
                    visible.map((item, index) => (
                        <div
                            key={item.returnAttemptId}
                            className={cn(
                                'relative grid h-[44px] items-center px-[14px] text-[12.5px]',
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
                            <span className="font-medium text-brand-ink-soft">{item.userRef}</span>
                            <span className="font-bold text-brand-ink">{item.returnAttemptId}</span>
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
                            <span className="flex justify-center">
                                <DetailLink to={`/history/returns/${item.returnAttemptId}`} />
                            </span>
                        </div>
                    ))
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
