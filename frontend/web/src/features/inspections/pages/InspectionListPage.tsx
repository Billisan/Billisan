import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

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
import { formatSlotLabel } from '@/features/stations/types';
import { DataTable, TBody, TableCard, Td, Th, THead, Tr } from '@/shared/components/DataTable';
import { FilterSelect, type FilterOption } from '@/shared/components/FilterSelect';
import { PageBar } from '@/shared/components/PageBar';

/**
 * 파손 검수 목록 — `SCR-WEB-INSPECTION-LIST-001` → `ADMIN-INSPECTION-001`.
 *
 * 시안(14번)과 다른 점 셋. 전부 계약 쪽을 따랐습니다.
 * 1. `반납ID · 대여소 검색` 칸을 뺐습니다. query 는 `aiResult,reviewStatus,modelVersion,from,to,
 *    cursor,size` 뿐이고 키워드가 없습니다. 대신 계약에 있는 조회 기간을 넣었습니다.
 * 2. `촬영 시각` → `처리 시각`. 응답 필드는 `processedAt`(추론 처리 시각)이고 촬영 시각은 없습니다.
 * 3. 숫자 페이지 → 이전/다음. 응답에 `nextCursor` 만 있어 임의 페이지로 뛸 수 없습니다.
 */

const AI_RESULT_OPTIONS: readonly FilterOption<AiResultFilter>[] = [
    { value: 'ALL', label: 'AI 결과' },
    // 계약 Enum(`InspectionResult`) 네 값 그대로입니다. 목록에 NORMAL 행이 없는 건 정상입니다 —
    // AI 가 정상으로 본 반납은 관리자 검수로 넘어오지 않습니다.
    { value: 'NORMAL', label: 'NORMAL' },
    { value: 'DAMAGED', label: 'DAMAGED' },
    { value: 'UNCERTAIN', label: 'UNCERTAIN' },
    { value: 'FAILED', label: 'FAILED' },
];

const REVIEW_OPTIONS: readonly FilterOption<ReviewStatusFilter>[] = [
    { value: 'ALL', label: '처리 상태' },
    { value: 'PENDING', label: '검수 대기' },
    { value: 'DECIDED', label: '검수 완료' },
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
    const { data, isPending, isError, error } = useInspectionList({
        aiResult,
        reviewStatus,
        from: fromDateOf(period),
        cursor,
        size: INSPECTION_PAGE_SIZE,
    });

    const rows = data?.rows ?? [];
    const pendingCount = rows.filter(({ item }) => item.reviewStatus === 'PENDING').length;

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        const params = new URLSearchParams();
        if (aiInput !== 'ALL') params.set('ai', aiInput);
        if (reviewInput !== 'ALL') params.set('review', reviewInput);
        if (periodInput !== 'ALL') params.set('period', periodInput);
        setSearchParams(params);
    };

    return (
        <div>
            <PageBar meta={`${INSPECTIONS_SYNCED_AT} 기준`} />

            <div className="mb-[22px] flex items-center justify-between gap-4">
                <h2 className="text-[21px] font-extrabold leading-none text-brand-ink">
                    파손 검수
                </h2>

                <form onSubmit={handleSubmit} className="flex items-center gap-3">
                    <FilterSelect
                        label="조회 기간"
                        value={periodInput}
                        onChange={setPeriodInput}
                        options={PERIOD_OPTIONS}
                        className="w-[140px]"
                    />
                    <FilterSelect
                        label="AI 결과 필터"
                        value={aiInput}
                        onChange={setAiInput}
                        options={AI_RESULT_OPTIONS}
                        className="w-[140px]"
                    />
                    <FilterSelect
                        label="처리 상태 필터"
                        value={reviewInput}
                        onChange={setReviewInput}
                        options={REVIEW_OPTIONS}
                        className="w-[140px]"
                    />
                    <button
                        type="submit"
                        className="h-[38px] w-[78px] rounded-[7px] bg-brand-blue text-[13px] font-bold text-white transition-colors hover:bg-brand-blue/90"
                    >
                        조회
                    </button>
                </form>
            </div>

            {isPending ? (
                <ListState>불러오는 중…</ListState>
            ) : isError ? (
                <ListState>목록을 불러오지 못했습니다. {error.message}</ListState>
            ) : rows.length > 0 ? (
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
                            {rows.map(({ item, station, slot }) => {
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
                                            {/*
                                             * 대여소 이름은 `ADMIN-INSPECTION-001` 응답에 없습니다.
                                             * 목업이라 대여소 목록에서 붙여 씁니다.
                                             * TODO: 실연동 시 백엔드에 `stationName` 추가를 요청하세요.
                                             */}
                                            <span className="block font-medium text-brand-ink-soft">
                                                {station.name}
                                            </span>
                                            <span className="mt-[3px] block text-[10.8px] font-medium text-brand-muted">
                                                {station.stationCode} ·{' '}
                                                {formatSlotLabel(
                                                    station.stationCode,
                                                    slot.slotNumber,
                                                )}
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
                    이 쪽 {rows.length}건 · 검수 대기 {pendingCount}건
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
