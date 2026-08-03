import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { env } from '@/config/env';
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
import { shortId } from '@/shared/lib/shortId';
import { mockSyncedAt, syncedAtLabel } from '@/shared/lib/syncedAt';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/PageState';
import { RefId } from '@/shared/components/RefId';
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
 * **AI 가 정상으로 본 반납은 관리자 판정 대상이 아닙니다** — `DECIDED` 로 바로 처리되어
 * 「검수 대기」에는 올라오지 않습니다. 관리자에게 넘어오는 건 파손·불확실·실패 건입니다.
 *
 * 다만 검수 **레코드 자체는 반납 시도마다 남습니다**(DB 유니크 제약 `uk_damage_inspection_
 * return_attempt_id`). 그래서 처리 상태를 「전체」로 두면 이미 끝난 `정상 판정 · 검수 완료`
 * 행이 함께 보입니다 (EC2 시드의 `7aa9f1b8…`). 기록으로 남기는 건 맞고, 기본 화면에
 * 섞이지 않게 아래에서 기본값을 「검수 대기」로 둡니다.
 *
 * 선택지는 계약 Enum 을 다 열어 둡니다 — 지난 정상 건도 필요하면 찾아볼 수 있어야 합니다.
 */
const AI_RESULT_OPTIONS: readonly FilterOption<AiResultFilter>[] = [
    { value: 'ALL', label: '전체' },
    { value: 'NORMAL', label: AI_RESULT_LABEL.NORMAL },
    { value: 'DAMAGED', label: AI_RESULT_LABEL.DAMAGED },
    { value: 'UNCERTAIN', label: AI_RESULT_LABEL.UNCERTAIN },
    { value: 'FAILED', label: AI_RESULT_LABEL.FAILED },
];

const REVIEW_OPTIONS: readonly FilterOption<ReviewStatusFilter>[] = [
    { value: 'ALL', label: '전체' },
    // 처리 상태 배지와 같은 매핑을 씁니다.
    { value: 'PENDING', label: REVIEW_STATUS_LABEL.PENDING },
    { value: 'DECIDED', label: REVIEW_STATUS_LABEL.DECIDED },
];

/**
 * 처리 상태의 기본값. **URL 에서 생략됐을 때 쓰는 값이라 두 곳이 같은 상수를 봐야 합니다** —
 * 읽을 때(`parseOption` 의 fallback)와 쓸 때(`applyFilters` 가 생략할 값)가 어긋나면
 * 「전체」를 골라도 파라미터가 빠져 다시 이 값으로 돌아옵니다.
 */
const REVIEW_DEFAULT: ReviewStatusFilter = 'PENDING';

const PERIOD_OPTIONS: readonly FilterOption<string>[] = [
    { value: 'ALL', label: '전체' },
    { value: '1', label: '최근 1일' },
    { value: '7', label: '최근 7일' },
    { value: '30', label: '최근 30일' },
];

/**
 * 기간 선택 → `from` 날짜.
 *
 * 기준일이 모드에 따라 다릅니다 — 목업은 데이터가 목업 기준 시각(07-24)에 고정돼 있어
 * 거기서 거꾸로 세야 하고, 실 API 는 오늘부터 셉니다. 서버가 시각을 UTC 로 기록하는 것이
 * 실측돼서(팀 확인 중) 실모드 기준일도 UTC 로 만듭니다 — 문자열 비교 대상이 같은 축이어야
 * 경계일이 안 밀립니다.
 */
function fromDateOf(period: string): string {
    if (period === 'ALL') return '';

    const base = env.useMockData
        ? INSPECTIONS_SYNCED_AT.slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const [y, m, d] = base.split('-').map(Number);
    const at = new Date(Date.UTC(y, m - 1, d - Number(period)));
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
}

/**
 * URL Query 값 → 선택지 값. 목록에 없는 값이면 `fallback` 으로 떨어집니다.
 *
 * `fallback` 을 따로 받는 이유는 **드롭다운 첫 줄과 기본값이 서로 달라야 하는 필터**가
 * 있어서입니다. 처리 상태는 선택지 순서를 「전체 → 검수 대기 → 검수 완료」로 두면서도
 * 처음 들어왔을 때는 「검수 대기」로 시작합니다.
 */
function parseOption<T extends string>(
    value: string | null,
    options: readonly FilterOption<T>[],
    fallback: T = options[0].value,
): T {
    return options.some((option) => option.value === value) ? (value as T) : fallback;
}

export function InspectionListPage() {
    const navigate = useNavigate();
    // 확정된 조회 조건은 URL Query 에만 둡니다 (화면흐름 §6.2).
    const [searchParams, setSearchParams] = useSearchParams();
    const aiResult = parseOption(searchParams.get('ai'), AI_RESULT_OPTIONS);
    /*
     * **기본값은 「검수 대기」입니다.**
     *
     * 관리자가 이 화면에 오는 목적은 **판정할 게 남았는지 보는 것**입니다. 그런데 검수
     * 레코드는 반납 시도마다 남고 AI 가 정상으로 본 건은 `DECIDED` 로 바로 처리되므로,
     * 운영이 쌓이면 「전체」 목록의 대부분이 손댈 필요 없는 완료 건이 됩니다. 처리할 것이
     * 그 안에 파묻히지 않게 처음부터 미처리만 보여 줍니다.
     *
     * 전부 보고 싶으면 드롭다운에서 「전체」를 고르면 되고, 그 선택은 URL 에 남습니다.
     * 대시보드의 「파손 검수 대기」 바로가기(`review=PENDING`)와도 같은 화면이 됩니다.
     */
    const reviewStatus = parseOption(searchParams.get('review'), REVIEW_OPTIONS, REVIEW_DEFAULT);
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
    const { data, isPending, isError, error, refetch, isFetching, dataUpdatedAt } =
        useInspectionList({
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
        /*
         * 생략 기준이 `'ALL'` 이 아니라 **기본값**입니다.
         *
         * 처리 상태는 기본이 「검수 대기」라, 예전처럼 `'ALL'` 일 때 파라미터를 빼면
         * 「전체」를 고른 순간 주소에서 조건이 사라지고 다시 「검수 대기」로 읽힙니다 —
         * 드롭다운은 「전체」인데 목록은 미처리만 나오는 상태가 됩니다.
         */
        if (nextReview !== REVIEW_DEFAULT) params.set('review', nextReview);
        if (nextPeriod !== 'ALL') params.set('period', nextPeriod);
        setSearchParams(params);
    };

    /**
     * 목록이 조건으로 **좁혀져 있는지**. 빈 화면에서 「조건에 맞는 검수가 없습니다」와
     * 초기화 버튼을 보일지 정합니다.
     *
     * 기본값인 「검수 대기」도 좁힌 것으로 셉니다 — 처리할 게 없어서 비었을 때 관리자가
     * 「전체」로 넓혀 볼 수 있어야 하기 때문입니다. 여기서 빼면 초기화 버튼이 사라져,
     * 지난 검수 기록이 있는데도 아무것도 없는 화면처럼 보입니다.
     */
    const hasFilter = aiResult !== 'ALL' || reviewStatus !== 'ALL' || period !== 'ALL';

    return (
        <div>
            <PageBar meta={syncedAtLabel(mockSyncedAt(INSPECTIONS_SYNCED_AT), dataUpdatedAt)} />

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
                <LoadingState />
            ) : isError ? (
                /*
                 * 예전에는 문구 한 줄만 띄웠습니다. **다시 시도할 방법이 화면에 없어서**
                 * 관리자가 할 수 있는 게 새로고침(F5)뿐이었습니다. 그러면 조회 조건이
                 * URL 에 있어 살아남긴 해도 화면 전체가 다시 뜹니다.
                 *
                 * 빈 목록은 이미 공용 `EmptyState` 를 쓰고 있었는데 로딩·오류만 자체
                 * 구현이라, 같은 화면 안에서 세 상태의 생김새가 달랐습니다.
                 */
                <ErrorState error={error} onRetry={() => void refetch()} />
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
                                신뢰도
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

                                /*
                                 * **행 전체 클릭은 「상세」 행에만 답니다.**
                                 *
                                 * 대여소·슬롯 표와 같은 편의인데, 여기서는 미처리(`PENDING`)
                                 * 행을 뺍니다. 그 행의 목적지는 판정 폼이라 **관리자가 값을
                                 * 확정하는 자리**입니다. 표를 훑다가 행을 잘못 스쳐 눌러 판정
                                 * 화면이 열리면, 되돌릴 수 없는 작업 앞에 실수로 서게 됩니다.
                                 * 미처리 행은 지금처럼 「검수」 버튼을 정확히 눌러야 갑니다.
                                 *
                                 * 판정이 끝난 행은 읽기만 하는 화면이라 잘못 눌러도 손해가
                                 * 없습니다. 오히려 UUID 축약값을 확인하려고 좁은 「상세」
                                 * 링크를 겨냥해야 했던 쪽이 불편했습니다.
                                 *
                                 * 행 안의 링크·버튼(`RefId` 복사, 「상세」)은 `Tr` 이 이미
                                 * 걸러 줍니다 — 텍스트를 드래그해 고른 경우도 이동하지 않습니다.
                                 */
                                return (
                                    <Tr
                                        key={item.inspectionId}
                                        className="h-[57px]"
                                        accent={pending ? 'amber' : undefined}
                                        onClick={
                                            pending
                                                ? undefined
                                                : () =>
                                                      navigate(`/inspections/${item.inspectionId}`)
                                        }
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
                                            {/* 표시 보강(이름 명부)이 실패하면 축약 ID 로 버팁니다. */}
                                            <span className="block font-medium text-brand-ink-soft">
                                                {item.stationName ?? shortId(item.stationId)}
                                            </span>
                                            <span className="mt-[3px] block text-[10.8px] font-medium text-brand-muted">
                                                {item.slotNumber != null
                                                    ? `${item.slotNumber}번 슬롯`
                                                    : `슬롯 ${shortId(item.slotId)}`}
                                            </span>
                                        </Td>
                                        {/*
                                         * 36자 UUID 를 그대로 깔면 열 하나를 통째로 잡아먹고
                                         * 옆 값들이 밀립니다. 다른 화면과 같이 축약해서 보여 주고,
                                         * 전체 값은 마우스오버·복사로 꺼냅니다 (화면흐름 §12).
                                         */}
                                        <Td>
                                            <RefId id={item.returnAttemptId} label="반납 시도 ID" />
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
                /*
                 * 필터에 걸려 0건인 것과 검수가 아예 없는 것은 다릅니다. 대시보드에서
                 * '파손 검수 대기' 를 눌러 들어오면 `review=PENDING` 이 붙은 채로
                 * 도착하니, 그걸 잊고 "검수가 없다" 로 읽기 쉽습니다.
                 */
                <EmptyState
                    filtered={hasFilter}
                    onReset={() => {
                        setAiInput('ALL');
                        setReviewInput('ALL');
                        setPeriodInput('ALL');
                        applyFilters({ ai: 'ALL', review: 'ALL', period: 'ALL' });
                    }}
                >
                    {hasFilter ? '조회 조건에 맞는 검수가 없습니다.' : '검수 내역이 없습니다.'}
                </EmptyState>
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
