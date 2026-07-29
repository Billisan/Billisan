import { Search } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { DeviceBadge } from '@/features/stations/components/DeviceBadge';
import { SlotTable } from '@/features/stations/components/SlotTable';
import { useStation, useStationSlots } from '@/features/stations/hooks/useStations';
import { STATION_SYNCED_AT } from '@/features/stations/mocks/slots';
import {
    deriveSlotDisplayStatus,
    formatSlotLabel,
    type SlotDisplayStatus,
} from '@/features/stations/types';
import { FilterSelect, type FilterOption } from '@/shared/components/FilterSelect';
import { PageBar } from '@/shared/components/PageBar';
import { PageTitle } from '@/shared/components/PageTitle';
import { SLOT_DISPLAY_LABEL } from '@/shared/constants/statusLabels';

type StatusFilter =
    'ALL' | Extract<SlotDisplayStatus, 'AVAILABLE' | 'EMPTY' | 'ADMIN_REVIEW' | 'DAMAGED'>;

/**
 * '건조 중'은 넣지 않습니다. `DRYING` 은 DB Enum 이 아니고 채택 전까지 미표시입니다
 * (WF-WEB-CHANGE-004 · DEC-WEB-001).
 */
const STATUS_OPTIONS: readonly FilterOption<StatusFilter>[] = [
    { value: 'ALL', label: '우산 상태' },
    // 라벨은 손으로 적지 않고 공용 매핑에서 가져옵니다. 표의 배지와 어긋나면 안 됩니다.
    { value: 'AVAILABLE', label: SLOT_DISPLAY_LABEL.AVAILABLE },
    { value: 'EMPTY', label: SLOT_DISPLAY_LABEL.EMPTY },
    { value: 'ADMIN_REVIEW', label: SLOT_DISPLAY_LABEL.ADMIN_REVIEW },
    { value: 'DAMAGED', label: SLOT_DISPLAY_LABEL.DAMAGED },
];

function parseStatus(value: string | null): StatusFilter {
    return STATUS_OPTIONS.some((option) => option.value === value)
        ? (value as StatusFilter)
        : 'ALL';
}

export function StationDetailPage() {
    const { stationId } = useParams();
    // 라우트 파라미터는 UUID 입니다 ('ST-003' 같은 표시 코드가 아닙니다).
    const { data: station, isPending: stationPending } = useStation(stationId);
    // ADMIN-SLOT-001. 서버 필터가 계약에 없어 지금은 전부 받아 화면에서 거릅니다.
    // TODO: 슬롯 목록 query 파라미터가 확정되면 서버 필터·커서로 옮기세요.
    const { data: slotPage } = useStationSlots(stationId);

    // 확정된 조회 조건은 URL Query 에만 둡니다 (화면흐름 §6.2).
    const [searchParams, setSearchParams] = useSearchParams();
    const keyword = searchParams.get('q')?.trim() ?? '';
    const status = parseStatus(searchParams.get('status'));

    const [keywordInput, setKeywordInput] = useState(keyword);
    const [statusInput, setStatusInput] = useState(status);

    useEffect(() => {
        setKeywordInput(keyword);
        setStatusInput(status);
    }, [keyword, status]);

    const slots = useMemo(() => {
        if (!station) return [];

        const normalized = keyword.toLowerCase();
        /*
         * 검색 대상은 사람이 칠 수 있는 값뿐입니다 — 슬롯 표시 라벨('SL-03-01')과
         * 대여소 이름·코드. `slotId` 는 UUID 라 넣지 않습니다.
         */
        const stationText = `${station.name} ${station.stationCode}`.toLowerCase();

        return (slotPage?.items ?? []).filter((slot) => {
            const label = formatSlotLabel(station.stationCode, slot.slotNumber).toLowerCase();
            const matchesKeyword =
                !normalized || label.includes(normalized) || stationText.includes(normalized);
            const matchesStatus = status === 'ALL' || deriveSlotDisplayStatus(slot) === status;

            return matchesKeyword && matchesStatus;
        });
    }, [station, slotPage, keyword, status]);

    if (stationPending) {
        return (
            <div>
                <PageBar breadcrumb={[{ label: '대여소 관리', to: '/stations' }]} />
                <div className="flex h-[200px] items-center justify-center rounded-lg bg-white text-[13px] font-medium text-brand-muted">
                    불러오는 중…
                </div>
            </div>
        );
    }

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

    /*
     * 페이지를 나누지 않습니다. 대여소당 SLOT 은 제품 구조상 3~5개이고
     * `ADMIN-SLOT-001` 도 "P0 목록은 소규모 고정 구성으로 cursor를 사용하지 않는다"고 합니다.
     */
    const rows = slots;

    const applyQuery = (next: { keyword: string; status: StatusFilter }) => {
        const params = new URLSearchParams();
        if (next.keyword) params.set('q', next.keyword);
        if (next.status !== 'ALL') params.set('status', next.status);
        setSearchParams(params);
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        applyQuery({ keyword: keywordInput.trim(), status: statusInput });
    };

    return (
        <div>
            <PageBar
                className="mb-6"
                breadcrumb={[
                    { label: '대여소 관리', to: '/stations' },
                    { label: `${station.stationCode} ${station.name}` },
                ]}
                meta={`최근 통신 ${STATION_SYNCED_AT}`}
            />

            <div className="mb-[29px] flex items-center gap-3">
                <PageTitle className="mr-[11px]" documentTitle={`${station.name} 대여소`}>
                    {station.name}
                </PageTitle>
                <span className="text-[13px] font-bold text-brand-muted">
                    {station.stationCode}
                </span>
                {/* 슬롯별 온라인과 같은 값입니다. 대여소 장치 상태에서 파생합니다(GAP-WEB-013). */}
                <DeviceBadge status={station.deviceStatus} />
            </div>

            {/*
             * 왼쪽에 즉시 반영되는 드롭다운, 오른쪽에 눌러야 하는 검색어 + `조회`.
             * 검색칸과 버튼이 붙어 있어야 그 둘이 한 벌이라는 게 보입니다.
             */}
            <form onSubmit={handleSubmit} className="mb-9 flex items-center gap-3">
                <FilterSelect
                    label="우산 상태 필터"
                    value={statusInput}
                    onChange={(next) => {
                        setStatusInput(next);
                        applyQuery({ keyword, status: next });
                    }}
                    options={STATUS_OPTIONS}
                    className="w-[150px]"
                />

                <label className="relative block">
                    <span className="sr-only">슬롯 번호·대여소 검색</span>
                    <Search
                        className="pointer-events-none absolute left-[14px] top-1/2 size-[13px] -translate-y-1/2 text-brand-muted"
                        aria-hidden
                    />
                    <input
                        value={keywordInput}
                        onChange={(event) => setKeywordInput(event.target.value)}
                        placeholder="슬롯 번호 · 대여소 검색"
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

            {rows.length > 0 ? (
                <SlotTable station={station} slots={rows} />
            ) : (
                <div className="flex h-[200px] items-center justify-center rounded-lg bg-white text-[13px] font-medium text-brand-muted">
                    조건에 맞는 슬롯이 없습니다.
                </div>
            )}

            <p className="mt-[22px] text-xs font-semibold text-brand-body">
                전체 {rows.length}개 슬롯
            </p>
        </div>
    );
}
