import { ChevronDown, Search } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

import { StationTable } from '@/features/stations/components/StationTable';
import { MOCK_STATIONS, STATIONS_SYNCED_AT } from '@/features/stations/mocks/stations';
import { PageBar } from '@/shared/components/PageBar';
import { Pagination } from '@/shared/components/Pagination';

type OnlineFilter = 'ALL' | 'ONLINE' | 'OFFLINE';

const ONLINE_OPTIONS: { value: OnlineFilter; label: string }[] = [
    { value: 'ALL', label: '온라인 상태' },
    { value: 'ONLINE', label: '온라인' },
    { value: 'OFFLINE', label: '오프라인' },
];

const PAGE_SIZE = 8;

export function StationListPage() {
    // 입력 중인 값과 '조회'로 확정된 값을 분리해 둡니다.
    const [keywordInput, setKeywordInput] = useState('');
    const [onlineInput, setOnlineInput] = useState<OnlineFilter>('ALL');
    const [filter, setFilter] = useState<{ keyword: string; online: OnlineFilter }>({
        keyword: '',
        online: 'ALL',
    });
    const [page, setPage] = useState(1);

    const filtered = useMemo(() => {
        const keyword = filter.keyword.trim().toLowerCase();

        return MOCK_STATIONS.filter((station) => {
            const matchesKeyword =
                !keyword ||
                station.name.toLowerCase().includes(keyword) ||
                station.id.toLowerCase().includes(keyword);
            const matchesOnline =
                filter.online === 'ALL' ||
                (filter.online === 'ONLINE' ? station.online : !station.online);

            return matchesKeyword && matchesOnline;
        });
    }, [filter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        setFilter({ keyword: keywordInput, online: onlineInput });
        setPage(1);
    };

    return (
        <div>
            <PageBar meta={`${STATIONS_SYNCED_AT} 기준`} />

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

                <label className="relative block">
                    <span className="sr-only">온라인 상태 필터</span>
                    <select
                        value={onlineInput}
                        onChange={(event) => setOnlineInput(event.target.value as OnlineFilter)}
                        className="h-[38px] w-[150px] appearance-none rounded-lg border border-brand-border-soft bg-white pl-[14px] pr-9 text-[12.5px] font-medium text-brand-body outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-brand-blue/40"
                    >
                        {ONLINE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown
                        className="pointer-events-none absolute right-[14px] top-1/2 size-4 -translate-y-1/2 text-brand-muted"
                        aria-hidden
                    />
                </label>

                <button
                    type="submit"
                    className="h-[38px] w-[78px] rounded-[7px] bg-brand-blue text-[13px] font-bold text-white transition-colors hover:bg-brand-blue/90"
                >
                    조회
                </button>
            </form>

            {rows.length > 0 ? (
                <StationTable stations={rows} />
            ) : (
                <div className="flex h-[200px] items-center justify-center rounded-lg bg-white text-[13px] font-medium text-brand-muted">
                    조건에 맞는 대여소가 없습니다.
                </div>
            )}

            <div className="mt-[22px] flex justify-end pr-2">
                <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
            </div>
        </div>
    );
}
