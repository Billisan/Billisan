import { LogOut, Search, ShieldCheck, TriangleAlert, Umbrella } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

import { DetailLink } from '@/features/stations/components/DetailLink';
import { InspectLink } from '@/features/stations/components/InspectLink';
import { useInventory, useStationSlots } from '@/features/stations/hooks/useStations';
import { SLOT_PAGE_SIZE } from '@/features/stations/mocks/slots';
import { MOCK_STATIONS, STATIONS_SYNCED_AT } from '@/features/stations/mocks/stations';
import {
    deriveSlotDisplayStatus,
    formatSlotLabel,
    formatUpdatedAt,
    pendingInspectionId,
    SLOT_DISPLAY_TONE,
    slotStatusText,
    type SlotDisplayStatus,
    type Station,
} from '@/features/stations/types';
import { Badge } from '@/shared/components/Badge';
import { FilterSelect, type FilterOption } from '@/shared/components/FilterSelect';
import { PageBar } from '@/shared/components/PageBar';
import { Pagination } from '@/shared/components/Pagination';
import { cn } from '@/lib/utils';

/**
 * 슬롯 기반 우산 재고 — `SCR-WEB-SLOT-INVENTORY-001` (P0).
 *
 * **대여소를 먼저 골라야 하는 화면입니다.** 시안은 여러 대여소를 한 표에 섞어 놨지만
 * P0 API 두 개가 모두 대여소 단위라 그렇게는 만들 수 없습니다.
 *   ADMIN-INVENTORY-001  GET /api/v1/admin/stations/{stationId}/inventory  (집계 카드)
 *   ADMIN-SLOT-001       GET /api/v1/admin/stations/{stationId}/slots      (표)
 * cursor 도 대여소 단위라 전 대여소 통합 페이징 자체가 성립하지 않습니다.
 *
 * `umbrellaId` 는 쓰지 않습니다. 화면의 '우산 재고'는 슬롯 점유 재고의 사용자 친화 명칭입니다
 * (화면흐름 §7.5 · §3.1).
 *
 * 액션은 상세 이동과 검수 이동뿐입니다. 상태 변경은 슬롯 상세의 액션이라 여기 두지 않습니다
 * (§7.5 ACT-WEB-INVENTORY-001~005 · §7.6).
 */

type StatusFilter =
    | 'ALL'
    | Extract<SlotDisplayStatus, 'AVAILABLE' | 'RENTED' | 'EMPTY' | 'ADMIN_REVIEW' | 'DAMAGED'>;

/**
 * §7.5 의 필터 목록에서 '건조 중'을 뺀 것입니다.
 * `DRYING` 은 DB Enum 이 아니고 채택 전까지 미표시입니다 (WF-WEB-CHANGE-004 · DEC-WEB-001).
 */
const STATUS_OPTIONS: readonly FilterOption<StatusFilter>[] = [
    { value: 'ALL', label: '우산 상태' },
    { value: 'AVAILABLE', label: '사용 가능' },
    { value: 'RENTED', label: '대여 중' },
    { value: 'EMPTY', label: '빈 슬롯' },
    { value: 'ADMIN_REVIEW', label: '관리자 확인' },
    { value: 'DAMAGED', label: '파손' },
];

// 드롭다운 value 는 UUID 입니다. 그대로 `ADMIN-INVENTORY-001` 의 경로 변수로 들어갑니다.
const STATION_OPTIONS: readonly FilterOption<string>[] = MOCK_STATIONS.map((station) => ({
    value: station.stationId,
    label: `${station.name} (${station.stationCode})`,
}));

function parseStatus(value: string | null): StatusFilter {
    return STATUS_OPTIONS.some((option) => option.value === value)
        ? (value as StatusFilter)
        : 'ALL';
}

function parseStation(value: string | null): string {
    return MOCK_STATIONS.some((station) => station.stationId === value)
        ? (value as string)
        : MOCK_STATIONS[0].stationId;
}

function parsePage(value: string | null): number {
    const page = Number(value);
    return Number.isInteger(page) && page > 0 ? page : 1;
}

export function InventoryPage() {
    // 확정된 조회 조건은 URL Query 에만 둡니다 (화면흐름 §6.2).
    const [searchParams, setSearchParams] = useSearchParams();
    const stationId = parseStation(searchParams.get('station'));
    const keyword = searchParams.get('q')?.trim() ?? '';
    const status = parseStatus(searchParams.get('status'));
    const page = parsePage(searchParams.get('page'));

    const [stationInput, setStationInput] = useState(stationId);
    const [keywordInput, setKeywordInput] = useState(keyword);
    const [statusInput, setStatusInput] = useState(status);

    useEffect(() => {
        setStationInput(stationId);
        setKeywordInput(keyword);
        setStatusInput(status);
    }, [stationId, keyword, status]);

    const station = MOCK_STATIONS.find((item) => item.stationId === stationId) as Station;

    // 집계 카드는 필터와 무관하게 그 대여소의 전체 재고를 셉니다 (ADMIN-INVENTORY-001).
    // 표와 다른 API 라 따로 조회합니다 — 서버가 세어 준 값을 클라이언트가 다시 세지 않습니다.
    const { data: summary } = useInventory(stationId);
    const { data: slotPage } = useStationSlots(stationId);
    const allSlots = useMemo(() => slotPage?.items ?? [], [slotPage]);

    const slots = useMemo(() => {
        const normalized = keyword.toLowerCase();
        return allSlots.filter((slot) => {
            // 검색은 표시 라벨('SL-03-01')로 합니다. slotId 는 UUID 라 사람이 칠 수 없습니다.
            const label = formatSlotLabel(station.stationCode, slot.slotNumber).toLowerCase();
            const matchesKeyword = !normalized || label.includes(normalized);
            const matchesStatus = status === 'ALL' || deriveSlotDisplayStatus(slot) === status;

            return matchesKeyword && matchesStatus;
        });
    }, [allSlots, keyword, status, station.stationCode]);

    const counts = {
        available: summary?.available ?? 0,
        rented: summary?.rented ?? 0,
        review: summary?.adminReview ?? 0,
        damaged: summary?.damaged ?? 0,
    };

    const totalPages = Math.max(1, Math.ceil(slots.length / SLOT_PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * SLOT_PAGE_SIZE;
    const rows = slots.slice(start, start + SLOT_PAGE_SIZE);

    const applyQuery = (next: {
        station: string;
        keyword: string;
        status: StatusFilter;
        page: number;
    }) => {
        const params = new URLSearchParams();
        if (next.station !== MOCK_STATIONS[0].stationId) params.set('station', next.station);
        if (next.keyword) params.set('q', next.keyword);
        if (next.status !== 'ALL') params.set('status', next.status);
        if (next.page > 1) params.set('page', String(next.page));
        setSearchParams(params);
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        applyQuery({
            station: stationInput,
            keyword: keywordInput.trim(),
            status: statusInput,
            page: 1,
        });
    };

    return (
        <div>
            <PageBar className="mb-6" meta={`${STATIONS_SYNCED_AT} 기준`} />

            {/* 시안은 제목과 조회 조건이 같은 줄에 있습니다. */}
            <form onSubmit={handleSubmit} className="mb-[22px] flex items-center gap-3">
                <h2 className="mr-auto text-[21px] font-extrabold leading-none text-brand-ink">
                    우산 재고
                </h2>

                {/* P0 API 가 대여소 단위라 이 선택이 필수입니다. '전체'는 둘 수 없습니다. */}
                <FilterSelect
                    label="대여소"
                    value={stationInput}
                    onChange={setStationInput}
                    options={STATION_OPTIONS}
                    className="w-[150px]"
                />

                <label className="relative block">
                    <span className="sr-only">슬롯 검색</span>
                    <Search
                        className="pointer-events-none absolute left-[14px] top-1/2 size-[13px] -translate-y-1/2 text-brand-muted"
                        aria-hidden
                    />
                    <input
                        value={keywordInput}
                        onChange={(event) => setKeywordInput(event.target.value)}
                        placeholder="slotId · 거래ID 검색"
                        className="h-[38px] w-[320px] rounded-lg bg-brand-surface pl-[38px] pr-3 text-[12.5px] font-medium text-brand-ink outline-none transition-shadow placeholder:text-brand-muted focus-visible:ring-2 focus-visible:ring-brand-blue/40"
                    />
                </label>

                <FilterSelect
                    label="우산 상태 필터"
                    value={statusInput}
                    onChange={setStatusInput}
                    options={STATUS_OPTIONS}
                    className="w-[150px]"
                />

                <button
                    type="submit"
                    className="h-[38px] w-[78px] rounded-[7px] bg-brand-blue text-[13px] font-bold text-white transition-colors hover:bg-brand-blue/90"
                >
                    조회
                </button>
            </form>

            {/* 집계 카드 — 시안 기준 227x96, 간격 16 */}
            <div className="mb-4 grid grid-cols-4 gap-4">
                <StatCard
                    tone="green"
                    icon={<Umbrella className="size-[17px]" strokeWidth={2.1} aria-hidden />}
                    label="대여 가능 재고"
                    value={counts.available}
                    sub={`전체 ${allSlots.length}`}
                />
                <StatCard
                    tone="blue"
                    icon={<LogOut className="size-[17px]" strokeWidth={2.1} aria-hidden />}
                    label="대여 중"
                    value={counts.rented}
                />
                <StatCard
                    tone="amber"
                    icon={<ShieldCheck className="size-[17px]" strokeWidth={2.1} aria-hidden />}
                    label="관리자 확인 대상"
                    value={counts.review}
                    sub="검수 필요"
                />
                {/*
                 * 시안의 네 번째 카드는 '파손 · 분실'인데 분실은 뺐습니다.
                 * 분실은 `RENTAL.status = LOST` 라 SLOT 재고 집계인 ADMIN-INVENTORY-001 로는
                 * 셀 수 없습니다(화면흐름 §17). 대여 목록은 P1 신규 후보(WEB-API-CAND-002)입니다.
                 */}
                <StatCard
                    tone="red"
                    icon={<TriangleAlert className="size-[17px]" strokeWidth={2.1} aria-hidden />}
                    label="파손"
                    value={counts.damaged}
                />
            </div>

            <div className="overflow-hidden rounded-lg bg-white">
                {/* 열 폭은 시안 좌표 그대로입니다: 302 / 474 / 813.8(중앙) / 933 / 1149~1205 */}
                <div className="grid h-[42px] grid-cols-[172px_220px_239px_216px_56px] items-center bg-brand-surface pl-[14px] pr-[39px] text-[11.5px] font-bold text-brand-body">
                    <span>slotId</span>
                    <span>대여소</span>
                    <span className="text-center">상태</span>
                    <span>최근 상태 변경</span>
                    <span />
                </div>

                {rows.length > 0 ? (
                    rows.map((slot, index) => {
                        const display = deriveSlotDisplayStatus(slot);
                        const inspectionId = pendingInspectionId(slot);
                        // 주의가 필요한 행만 왼쪽에 색 막대를 답니다 (시안).
                        const accent =
                            display === 'DAMAGED'
                                ? 'bg-tone-red-fg'
                                : display === 'ADMIN_REVIEW'
                                  ? 'bg-tone-amber-fg'
                                  : null;

                        return (
                            <div
                                key={slot.slotId}
                                className="relative grid h-[42.9px] grid-cols-[172px_220px_239px_216px_56px] items-center pl-[14px] pr-[39px] text-[12.5px]"
                            >
                                {/* 구분선은 카드 폭 전체가 아니라 좌우 14px 안쪽까지만 긋습니다. */}
                                {index > 0 && (
                                    <span
                                        className="absolute inset-x-[14px] top-0 h-px bg-brand-line-soft"
                                        aria-hidden
                                    />
                                )}
                                {accent && (
                                    <span
                                        className={cn(
                                            'absolute left-[2px] top-1/2 h-[29px] w-[3px] -translate-y-1/2 rounded-full',
                                            accent,
                                        )}
                                        aria-hidden
                                    />
                                )}
                                <span className="font-bold text-brand-ink">
                                    {formatSlotLabel(station.stationCode, slot.slotNumber)}
                                </span>
                                <span className="font-medium text-brand-ink-soft">
                                    {station.name}
                                </span>
                                <span className="flex justify-center">
                                    <Badge
                                        tone={SLOT_DISPLAY_TONE[display]}
                                        className="whitespace-nowrap"
                                    >
                                        {slotStatusText(display)}
                                    </Badge>
                                </span>
                                <span className="font-medium tabular-nums text-brand-ink-soft">
                                    {formatUpdatedAt(slot.updatedAt)}
                                </span>
                                <span className="flex justify-center">
                                    {inspectionId ? (
                                        <InspectLink to={`/inspections/${inspectionId}`} />
                                    ) : (
                                        <DetailLink
                                            to={`/stations/${station.stationId}/slots/${slot.slotId}`}
                                        />
                                    )}
                                </span>
                            </div>
                        );
                    })
                ) : (
                    <div className="flex h-[200px] items-center justify-center text-[13px] font-medium text-brand-muted">
                        조건에 맞는 슬롯이 없습니다.
                    </div>
                )}
            </div>

            <div className="mt-[22px] flex items-center justify-between pr-2">
                <p className="text-xs font-semibold text-brand-body">
                    전체 {slots.length}개 슬롯 · {start + 1}–{start + rows.length} 표시
                </p>
                <Pagination
                    page={currentPage}
                    totalPages={totalPages}
                    onChange={(next) =>
                        applyQuery({ station: stationId, keyword, status, page: next })
                    }
                />
            </div>
        </div>
    );
}

const CARD_TONE = {
    green: { chip: 'bg-tone-green-bg text-tone-green-fg', value: 'text-tone-green-fg' },
    blue: { chip: 'bg-tone-blue-bg text-tone-blue-fg', value: 'text-tone-blue-fg' },
    amber: { chip: 'bg-tone-amber-bg text-tone-amber-fg', value: 'text-tone-amber-fg' },
    red: { chip: 'bg-tone-red-bg text-tone-red-fg', value: 'text-tone-red-fg' },
} as const;

function StatCard({
    tone,
    icon,
    label,
    value,
    sub,
}: {
    tone: keyof typeof CARD_TONE;
    icon: ReactNode;
    label: string;
    value: number;
    /** 큰 숫자와 같은 줄 오른쪽 끝에 붙는 보조 문구 (시안의 '전체 352' 자리) */
    sub?: string;
}) {
    return (
        <div className="h-[96px] rounded-[10px] border border-brand-line-soft bg-white px-[18px] pt-4">
            <div className="flex items-center gap-[10px]">
                <span
                    className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-[9px]',
                        CARD_TONE[tone].chip,
                    )}
                >
                    {icon}
                </span>
                <span className="text-[12.5px] font-semibold text-brand-body">{label}</span>
            </div>
            <div className="mt-[10px] flex items-baseline justify-between">
                <p
                    className={cn(
                        'text-[26px] font-extrabold leading-none tabular-nums',
                        CARD_TONE[tone].value,
                    )}
                >
                    {value}
                </p>
                {sub && <span className="text-[11px] font-semibold text-brand-muted">{sub}</span>}
            </div>
        </div>
    );
}
