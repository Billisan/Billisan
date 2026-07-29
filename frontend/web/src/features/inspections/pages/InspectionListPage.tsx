import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { AI_RESULT_LABEL, REVIEW_STATUS_LABEL } from '@/shared/constants/statusLabels';

import {
    AiResultBadge,
    CursorPager,
    ReviewStatusBadge,
    ScoreBar,
} from '@/features/inspections/components/InspectionParts';
import { useInspectionList } from '@/features/inspections/hooks/useInspections';
import {
    INSPECTION_PAGE_SIZE,
    INSPECTIONS_SYNCED_AT,
    type AiResultFilter,
    type ReviewStatusFilter,
} from '@/features/inspections/mocks/inspections';
import { DetailLink } from '@/features/stations/components/DetailLink';
import { InspectLink } from '@/features/stations/components/InspectLink';
import { DataTable, TBody, TableCard, Td, Th, THead, Tr } from '@/shared/components/DataTable';
import { FilterSelect, type FilterOption } from '@/shared/components/FilterSelect';
import { PageBar } from '@/shared/components/PageBar';
import { PageTitle } from '@/shared/components/PageTitle';

/**
 * 파손 검수 목록 — `SCR-WEB-INSPECTION-LIST-001` → `ADMIN-INSPECTION-001`.
 *
 * 시안(14번)과 다른 점 셋. 전부 계약 쪽을 따랐습니다.
 * 1. `반납ID · 대여소 검색` 칸을 뺐습니다. query 는 `aiResult,reviewStatus,modelVersion,from,to,
 *    cursor,size` 뿐이고 키워드가 없습니다. 대신 계약에 있는 조회 기간을 넣었습니다.
 * 2. `촬영 시각` → `처리 시각`. 응답 필드는 `processedAt`(추론 처리 시각)이고 촬영 시각은 없습니다.
 * 3. 숫자 페이지 → 이전/다음. 응답에 `nextCursor` 만 있어 임의 페이지로 뛸 수 없습니다.
 */

/**
 * 값은 계약 Enum(`InspectionResult`) 네 개 그대로 보내고, **화면 글자는 한글**입니다.
 * 라벨을 손으로 적지 않고 공용 매핑에서 가져와 표의 AI 결과 배지와 어긋나지 않게 합니다
 * (ERD §2.4.1 "관리자 웹의 배지·표·상세 화면은 한글 명칭 우선").
 *
 * 목록에 `정상 판정` 행이 없는 건 정상입니다 — AI 가 정상으로 본 반납은 관리자 검수로
 * 넘어오지 않습니다. 선택지는 계약 Enum 을 다 열어 둡니다.
 */
const AI_RESULT_OPTIONS: readonly FilterOption<AiResultFilter>[] = [
    { value: 'ALL', label: 'AI 결과' },
    { value: 'NORMAL', label: AI_RESULT_LABEL.NORMAL },
    { value: 'DAMAGED', label: AI_RESULT_LABEL.DAMAGED },
    { value: 'UNCERTAIN', label: AI_RESULT_LABEL.UNCERTAIN },
    { value: 'FAILED', label: AI_RESULT_LABEL.FAILED },
];

const REVIEW_OPTIONS: readonly FilterOption<ReviewStatusFilter>[] = [
    { value: 'ALL', label: '처리 상태' },
    // 처리 상태 배지와 같은 매핑을 씁니다.
    { value: 'PENDING', label: REVIEW_STATUS_LABEL.PENDING },
    { value: 'DECIDED', label: REVIEW_STATUS_LABEL.DECIDED },
];

const PERIOD_OPTIONS: readonly FilterOption<string>[] = [
    { value: 'ALL', label: '전체 기간' },
    { value: '1', label: '최근 1일' },
    { value: '7', label: '최근 7일' },
    { value: '30', label: '최근 30일' },
];

/** 기간 선택 → `from` 날짜. 목업 기준 시각에서 거꾸로 셉니다. */
function fromDateOf(period: string): string {
    if (period === 'ALL') return '';

    const [y, m, d] = INSPECTIONS_SYNCED_AT.slice(0, 10).split('-').map(Number);
    const at = new Date(Date.UTC(y, m - 1, d - Number(period)));
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
}

function parseOption<T extends string>(
    value: string | null,
    options: readonly FilterOption<T>[],
): T {
    return options.some((option) => option.value === value) ? (value as T) : options[0].value;
}

export function InspectionListPage() {
    // 확정된 조회 조건은 URL Query 에만 둡니다 (화면흐름 §6.2).
    const [searchParams, setSearchParams] = useSearchParams();
    const aiResult = parseOption(searchParams.get('ai'), AI_RESULT_OPTIONS);
    const reviewStatus = parseOption(searchParams.get('review'), REVIEW_OPTIONS);
    const period = parseOption(searchParams.get('period'), PERIOD_OPTIONS);

    const [aiInput, setAiInput] = useState(aiResult);
    const [reviewInput, setReviewInput] = useState(reviewStatus);
    const [periodInput, setPeriodInput] = useState(period);

    /**
     * 지나온 cursor 들. 맨 뒤가 지금 쪽입니다.
     *
     * cursor 는 불투명 문자열이라 이전 쪽을 계산해 낼 수 없습니다. 되돌아가려면
     * 지나온 값을 들고 있는 수밖에 없습니다.
     */
    const [trail, setTrail] = useState<(string | null)[]>([null]);

    // 조건이 바뀌면 첫 쪽부터 다시 셉니다. cursor 를 그대로 들고 가면 엉뚱한 구간이 나옵니다.
    useEffect(() => {
        setAiInput(aiResult);
        setReviewInput(reviewStatus);
        setPeriodInput(period);
        setTrail([null]);
    }, [aiResult, reviewStatus, period]);

    const cursor = trail[trail.length - 1];

    // ADMIN-INSPECTION-001. 목업인지 실 API 인지는 inspectionsApi 안에서만 갈립니다.
    const { data, isPending, isError, error, refetch, isFetching } = useInspectionList({
        aiResult,
        reviewStatus,
        from: fromDateOf(period),
        cursor,
        size: INSPECTION_PAGE_SIZE,
    });

    const items = data?.items ?? [];
    const pendingCount = items.filter((item) => item.reviewStatus === 'PENDING').length;

    /**
     * 드롭다운을 고르는 즉시 URL 에 반영합니다.
     *
     * 이 화면은 조회 조건이 전부 드롭다운이라 '조회' 버튼이 할 일이 없습니다. 대신 버튼을
     * **수동 갱신**으로 돌립니다 — 검수는 계속 새로 들어오는 목록이고, 화면흐름 §16 이
     * 오래된 데이터를 "조회 기준 시각·새로고침 표시 / 포커스 복귀 또는 수동 갱신"으로
     * 다루라고 정했습니다.
     */
    const applyFilters = (next: {
        ai?: typeof aiInput;
        review?: typeof reviewInput;
        period?: typeof periodInput;
    }) => {
        const nextAi = next.ai ?? aiResult;
        const nextReview = next.review ?? reviewStatus;
        const nextPeriod = next.period ?? period;

        const params = new URLSearchParams();
        if (nextAi !== 'ALL') params.set('ai', nextAi);
        if (nextReview !== 'ALL') params.set('review', nextReview);
        if (nextPeriod !== 'ALL') params.set('period', nextPeriod);
        setSearchParams(params);
    };

    return (
        <div>
            <PageBar meta={`${INSPECTIONS_SYNCED_AT} 기준`} />

            <div className="mb-[22px] flex items-center justify-between gap-4">
                <PageTitle>파손 검수</PageTitle>

                <div className="flex items-center gap-3">
                    <FilterSelect
                        label="조회 기간"
                        value={periodInput}
                        onChange={(next) => {
                            setPeriodInput(next);
                            applyFilters({ period: next });
                        }}
                        options={PERIOD_OPTIONS}
                        className="w-[140px]"
                    />
                    <FilterSelect
                        label="AI 결과 필터"
                        value={aiInput}
                        onChange={(next) => {
                            setAiInput(next);
                            applyFilters({ ai: next });
                        }}
                        options={AI_RESULT_OPTIONS}
                        className="w-[140px]"
                    />
                    <FilterSelect
                        label="처리 상태 필터"
                        value={reviewInput}
                        onChange={(next) => {
                            setReviewInput(next);
                            applyFilters({ review: next });
                        }}
                        options={REVIEW_OPTIONS}
                        className="w-[140px]"
                    />
                    <button
                        type="button"
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="inline-flex h-[38px] w-[92px] items-center justify-center gap-[6px] rounded-[7px] border border-brand-border-soft bg-white text-[13px] font-bold text-brand-body transition-colors hover:bg-brand-surface disabled:cursor-not-allowed disabled:text-brand-muted"
                    >
                        <RefreshCw
                            className={cn('size-[13px]', isFetching && 'animate-spin')}
                            aria-hidden
                        />
                        새로고침
                    </button>
                </div>
            </div>

            {isPending ? (
                <ListState>불러오는 중…</ListState>
            ) : isError ? (
                <ListState>목록을 불러오지 못했습니다. {error.message}</ListState>
            ) : items.length > 0 ? (
                <TableCard>
                    <DataTable>
                        {/* 열 너비는 시안(1280px)의 열 좌표에서 역산한 값입니다. */}
                        <THead>
                            <Th className="w-[11.5%]">처리 시각</Th>
                            <Th className="w-[19%]">위치</Th>
                            <Th className="w-[10%]">반납 ID</Th>
                            <Th align="center" className="w-[18%]">
                                AI 결과
                            </Th>
                            <Th align="center" className="w-[13.6%]">
                                추론 점수
                            </Th>
                            <Th align="center" className="w-[16%]">
                                처리
                            </Th>
                            <Th className="w-[8.9%]">
                                <span className="sr-only">검수 작업</span>
                            </Th>
                        </THead>

                        <TBody>
                            {items.map((item) => {
                                const pending = item.reviewStatus === 'PENDING';

                                return (
                                    <Tr
                                        key={item.inspectionId}
                                        className="h-[57px]"
                                        accent={pending ? 'amber' : undefined}
                                    >
                                        <Td>
                                            <span className="block font-medium tabular-nums text-brand-ink-soft">
                                                {item.processedAt.slice(11, 16)}
                                            </span>
                                            <span className="mt-[3px] block text-[10.8px] font-medium tabular-nums text-brand-muted">
                                                {item.processedAt.slice(5, 10)}
                                            </span>
                                        </Td>
                                        <Td>
                                            <span className="block font-medium text-brand-ink-soft">
                                                {item.stationName}
                                            </span>
                                            <span className="mt-[3px] block text-[10.8px] font-medium text-brand-muted">
                                                {item.slotNumber}번 슬롯
                                            </span>
                                        </Td>
                                        <Td className="font-bold tabular-nums text-brand-ink">
                                            {item.returnAttemptId}
                                        </Td>
                                        <Td align="center">
                                            <AiResultBadge result={item.aiResult} />
                                        </Td>
                                        <Td align="center">
                                            <ScoreBar
                                                score={item.aiScore}
                                                result={item.aiResult}
                                                className="mx-auto w-[92px]"
                                            />
                                        </Td>
                                        <Td align="center">
                                            <ReviewStatusBadge status={item.reviewStatus} />
                                        </Td>
                                        <Td align="center">
                                            {pending ? (
                                                <InspectLink
                                                    to={`/inspections/${item.inspectionId}`}
                                                />
                                            ) : (
                                                <DetailLink
                                                    to={`/inspections/${item.inspectionId}`}
                                                />
                                            )}
                                        </Td>
                                    </Tr>
                                );
                            })}
                        </TBody>
                    </DataTable>
                </TableCard>
            ) : (
                <ListState>조건에 맞는 검수가 없습니다.</ListState>
            )}

            <div className="mt-[22px] flex items-center justify-between pr-2">
                <p className="text-xs font-semibold text-brand-body">
                    이 쪽 {items.length}건 · 검수 대기 {pendingCount}건
                </p>
                <CursorPager
                    canPrev={trail.length > 1}
                    canNext={Boolean(data?.nextCursor)}
                    onPrev={() => setTrail((prev) => prev.slice(0, -1))}
                    onNext={() =>
                        setTrail((prev) => (data?.nextCursor ? [...prev, data.nextCursor] : prev))
                    }
                />
            </div>

            <p className="mt-[18px] text-[11px] font-medium leading-[1.6] text-brand-muted">
                AI 결과는 보조 판정이며 이것만으로 파손이 확정되거나 과금되지 않습니다. 확정은
                관리자 판정(`ADMIN-INSPECTION-003`)뿐입니다.
                <br />
                전체 건수와 페이지 수는 응답에 없습니다. 목록은 `nextCursor` 로만 이어집니다.
            </p>
        </div>
    );
}

/** 목록 자리에 들어가는 안내 한 줄 (로딩·오류·빈 목록 공용). */
function ListState({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-[200px] items-center justify-center rounded-lg bg-white text-[13px] font-medium text-brand-muted">
            {children}
        </div>
    );
}
