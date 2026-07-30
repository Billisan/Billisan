import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { StationTable } from '@/features/stations/components/StationTable';
import { useStations } from '@/features/stations/hooks/useStations';
import { STATIONS_SYNCED_AT } from '@/features/stations/mocks/stations';
import { ErrorState, LoadingState } from '@/shared/components/PageState';
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

        return stations.filter((station) =>
            // 대여소명으로만 찾습니다. UUID 를 외워서 치는 사람은 없고, 예전에 함께
            // 검색하던 `stationCode` 는 ERD v3.0 에서 P0 필수 컬럼이 아닙니다.
            station.name.toLowerCase().includes(normalized),
        );
    }, [keyword, stations]);

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
                    placeholder="대여소명 검색"
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
                <div className="flex h-[200px] items-center justify-center rounded-lg bg-white text-[13px] font-medium text-brand-muted">
                    조건에 맞는 대여소가 없습니다.
                </div>
            )}

            <div className="mt-[22px] flex justify-end pr-2">
                <Pagination
                    page={currentPage}
                    totalPages={totalPages}
                    onChange={(next) => applyQuery({ keyword, page: next })}
                />
            </div>
        </div>
    );
}
