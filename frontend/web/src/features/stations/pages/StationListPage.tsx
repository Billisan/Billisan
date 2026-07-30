import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { StationTable } from '@/features/stations/components/StationTable';
import { useStations } from '@/features/stations/hooks/useStations';
import { STATIONS_SYNCED_AT } from '@/features/stations/mocks/stations';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/PageState';
import { PageBar } from '@/shared/components/PageBar';
import { SearchInput } from '@/shared/components/SearchInput';
import { PageTitle } from '@/shared/components/PageTitle';
import { Pagination } from '@/shared/components/Pagination';

const PAGE_SIZE = 8;

/**
 * 조회 조건은 검색어 하나입니다.
 *
 * - 정렬 선택은 두지 않습니다. 목록 순서는 서버 응답 순서를 그대로 따릅니다
 *   (화면흐름 §6.2 / API명세 PART B 에 관리자 목록 sort 파라미터가 없습니다).
 * - 온라인/오프라인 필터도 두지 않습니다. 온라인 여부는 표의 배지로 이미 보이고,
 *   목록 API 에 대응하는 조회 파라미터가 없습니다.
 */

function parsePage(value: string | null): number {
    const page = Number(value);
    return Number.isInteger(page) && page > 0 ? page : 1;
}

export function StationListPage() {
    const query = useStations();
    const stations = useMemo(() => query.data ?? [], [query.data]);

    // 확정된 조회 조건은 URL Query 에만 둡니다. 새로고침·뒤로가기에도 유지돼야 합니다(§6.2).
    const [searchParams, setSearchParams] = useSearchParams();
    const keyword = searchParams.get('q')?.trim() ?? '';
    const page = parsePage(searchParams.get('page'));

    // 입력 중인 값. '조회'를 눌러야 위 URL 값으로 확정됩니다.
    const [keywordInput, setKeywordInput] = useState(keyword);

    // 뒤로가기·주소 직접 입력으로 URL 이 바뀌면 입력칸도 따라가야 합니다.
    useEffect(() => {
        setKeywordInput(keyword);
    }, [keyword]);

    const filtered = useMemo(() => {
        const normalized = keyword.toLowerCase();
        if (!normalized) return stations;

        return stations.filter(
            (station) =>
                station.name.toLowerCase().includes(normalized) ||
                /*
                 * **UUID 앞자리로도 찾습니다.**
                 *
                 * 아무도 36자를 외워서 치지는 않습니다. 하지만 반대 방향이 실제로 생깁니다 —
                 * 백엔드 로그·문의에 `de9ef0ce-…` 가 찍혀 있고 그게 어느 대여소인지 알아내야
                 * 할 때입니다. 그때 붙여 넣을 곳이 없으면 목록을 눈으로 훑어야 합니다.
                 *
                 * 표시가 앞 8자 축약이라 앞자리만 붙여 넣어도 걸리고, 36자 전체를 붙여 넣어도
                 * 걸립니다. 예전에 함께 검색하던 `stationCode` 는 ERD v3.0 에서 P0 필수
                 * 컬럼이 아니라 쓰지 않습니다.
                 */
                station.stationId.toLowerCase().startsWith(normalized),
        );
    }, [keyword, stations]);

    /**
     * 조회 결과 전체의 합계. **한 쪽이 아니라 `filtered` 전체를 셉니다.**
     *
     * 계약이 이 값을 따로 주지는 않습니다. `ADMIN-INVENTORY-001` 은 대여소 하나의 집계라
     * 전 대여소 합계를 내려면 목록을 받아 더하는 수밖에 없습니다.
     * TODO: 운영 집계 API(`WEB-API-CAND-001 · P1`)가 확정되면 그 값으로 바꾸세요.
     */
    const totals = useMemo(
        () =>
            filtered.reduce(
                (acc, station) => ({
                    available: acc.available + station.available,
                    capacity: acc.capacity + station.capacity,
                    damaged: acc.damaged + station.damaged,
                    adminReview: acc.adminReview + station.adminReview,
                }),
                { available: 0, capacity: 0, damaged: 0, adminReview: 0 },
            ),
        [filtered],
    );

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const rows = filtered.slice(start, start + PAGE_SIZE);

    /** 기본값은 URL 에서 빼서 주소를 짧게 유지합니다. */
    const applyQuery = (next: { keyword: string; page: number }) => {
        const params = new URLSearchParams();
        if (next.keyword) params.set('q', next.keyword);
        if (next.page > 1) params.set('page', String(next.page));
        setSearchParams(params);
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        applyQuery({ keyword: keywordInput.trim(), page: 1 });
    };

    return (
        <div>
            <PageBar className="mb-[18px]" meta={`${STATIONS_SYNCED_AT} 기준`} />

            {/*
             * 제목과 조회 줄을 한 줄에 놓고 조회 쪽을 오른쪽 끝에 붙입니다.
             * 예전에는 제목이 위, 조회 줄이 아래 왼쪽이라 오른쪽이 500px 넘게 비었습니다.
             * `mr-auto` 가 제목을 왼쪽에 고정하고 나머지를 오른쪽으로 밀어 줍니다.
             */}
            <form onSubmit={handleSubmit} className="mb-9 flex items-center gap-3">
                <PageTitle className="mr-auto">대여소 관리</PageTitle>

                <SearchInput
                    label="대여소 검색"
                    placeholder="대여소명 · 대여소 ID 검색"
                    value={keywordInput}
                    onChange={setKeywordInput}
                    onClear={() => {
                        setKeywordInput('');
                        applyQuery({ keyword: '', page: 1 });
                    }}
                    className="w-[320px]"
                />

                <button
                    type="submit"
                    className="h-[38px] w-[78px] rounded-[7px] bg-brand-blue text-[13px] font-bold text-white transition-colors hover:bg-brand-blue/90"
                >
                    조회
                </button>
            </form>

            {query.isPending ? (
                <LoadingState />
            ) : query.isError ? (
                <ErrorState error={query.error} onRetry={() => query.refetch()} />
            ) : rows.length > 0 ? (
                <StationTable stations={rows} />
            ) : (
                /*
                 * 검색어 때문에 0건인지, 정말 대여소가 없는지를 갈라 말합니다. 검색어를
                 * 넣어 둔 걸 잊으면 "대여소가 하나도 없다" 로 읽힙니다.
                 */
                <EmptyState
                    filtered={Boolean(keyword)}
                    onReset={() => {
                        setKeywordInput('');
                        applyQuery({ keyword: '', page: 1 });
                    }}
                >
                    {keyword
                        ? `'${keyword}' 에 해당하는 대여소가 없습니다.`
                        : '등록된 대여소가 없습니다.'}
                </EmptyState>
            )}

            {/*
             * 조회 결과 전체의 합계.
             *
             * 표는 한 쪽에 8개만 보여 주므로, 지금 보고 있는 쪽만으로는 캠퍼스 전체 재고를
             * 알 수 없습니다. 관리자가 제일 먼저 알고 싶은 건 "지금 빌려줄 수 있는 우산이
             * 몇 개인가" 라, 그 숫자를 페이지와 무관하게 한 줄로 둡니다.
             *
             * `filtered`(조회 조건이 걸린 전체) 기준입니다 — 검색 중이면 그 결과의 합계여야
             * 표와 아귀가 맞습니다.
             */}
            <div className="mt-[22px] flex items-center justify-between pr-2">
                <p className="text-xs font-semibold text-brand-body">
                    {`대여소 ${filtered.length}개소 · `}
                    <span className="text-brand-ink">사용 가능 {totals.available}</span>
                    {` / 전체 슬롯 ${totals.capacity}`}
                    {totals.damaged > 0 && ` · 파손 ${totals.damaged}`}
                    {totals.adminReview > 0 && ` · 관리자 확인 ${totals.adminReview}`}
                </p>
                <Pagination
                    page={currentPage}
                    totalPages={totalPages}
                    onChange={(next) => applyQuery({ keyword, page: next })}
                />
            </div>
        </div>
    );
}
