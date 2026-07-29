import { Search } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { StationTable } from '@/features/stations/components/StationTable';
import { useStations } from '@/features/stations/hooks/useStations';
import { STATIONS_SYNCED_AT } from '@/features/stations/mocks/stations';
import { ErrorState, LoadingState } from '@/shared/components/PageState';
import { PageBar } from '@/shared/components/PageBar';
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
                // 검색은 사람이 아는 표시 코드로 합니다. UUID 를 외워서 치는 사람은 없습니다.
                station.stationCode.toLowerCase().includes(normalized),
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
            <PageBar className="mb-6" meta={`${STATIONS_SYNCED_AT} 기준`} />

            {/* 대여소 상세와 같은 리듬(21px 제목 + 아래 29px)으로 맞춥니다. */}
            <h2 className="mb-[29px] text-[21px] font-extrabold leading-none text-brand-ink">
                대여소 관리
            </h2>

            <form onSubmit={handleSubmit} className="mb-9 flex items-center gap-3">
                <label className="relative block">
                    <span className="sr-only">대여소 검색</span>
                    <Search
                        className="pointer-events-none absolute left-[14px] top-1/2 size-[13px] -translate-y-1/2 text-brand-muted"
                        aria-hidden
                    />
                    <input
                        value={keywordInput}
                        onChange={(event) => setKeywordInput(event.target.value)}
                        placeholder="대여소명 · 대여소ID 검색"
                        className="h-[38px] w-[320px] rounded-lg bg-brand-surface pl-[38px] pr-3 text-[12.5px] font-medium text-brand-ink outline-none transition-shadow placeholder:text-brand-muted focus-visible:ring-2 focus-visible:ring-brand-blue/40"
                    />
                </label>

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
