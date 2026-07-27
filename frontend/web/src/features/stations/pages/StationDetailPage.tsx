import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { usePageTitle } from '@/components/layout/pageTitle';
import { SlotTable } from '@/features/stations/components/SlotTable';
import { buildSlots, SLOT_PAGE_SIZE, STATION_SYNCED_AT } from '@/features/stations/mocks/slots';
import { findStation } from '@/features/stations/mocks/stations';
import { PageBar } from '@/shared/components/PageBar';
import { Pagination } from '@/shared/components/Pagination';

export function StationDetailPage() {
    const { stationId } = useParams();
    const station = findStation(stationId);
    const [page, setPage] = useState(1);

    usePageTitle(station?.name);

    const slots = useMemo(() => (station ? buildSlots(station) : []), [station]);

    if (!station) {
        return (
            <div>
                <PageBar breadcrumb={[{ label: '대여소 관리', to: '/stations' }]} />
                <div className="flex h-[200px] items-center justify-center rounded-lg bg-white text-[13px] font-medium text-brand-muted">
                    존재하지 않는 대여소입니다. ({stationId})
                </div>
            </div>
        );
    }

    const totalPages = Math.max(1, Math.ceil(slots.length / SLOT_PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * SLOT_PAGE_SIZE;
    const rows = slots.slice(start, start + SLOT_PAGE_SIZE);

    return (
        <div>
            <PageBar
                breadcrumb={[
                    { label: '대여소 관리', to: '/stations' },
                    { label: `${station.id} ${station.name}` },
                ]}
                meta={`최근 통신 ${STATION_SYNCED_AT}`}
            />

            <div className="mb-[38px] flex h-9 items-center justify-between gap-4">
                <h2 className="text-[15px] font-extrabold text-brand-ink">슬롯 현황</h2>

                <div className="flex items-center gap-2">
                    {/* TODO: 기기 제어 API 연동 (상태 폴링 / 일괄 잠금 해제) */}
                    <button
                        type="button"
                        className="h-9 rounded-[7px] border border-brand-border-soft bg-white px-4 text-[12.5px] font-semibold text-brand-body transition-colors hover:bg-brand-surface"
                    >
                        상태 새로고침
                    </button>
                    <button
                        type="button"
                        className="h-9 rounded-[7px] border border-brand-border-soft bg-white px-4 text-[12.5px] font-semibold text-brand-body transition-colors hover:bg-brand-surface"
                    >
                        전체 잠금 해제
                    </button>
                </div>
            </div>

            <SlotTable stationId={station.id} slots={rows} />

            <div className="mt-[22px] flex items-center justify-between pr-2">
                <p className="text-xs font-semibold text-brand-body">
                    전체 {slots.length}개 슬롯 · {start + 1}–{start + rows.length} 표시
                </p>
                <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
            </div>
        </div>
    );
}
