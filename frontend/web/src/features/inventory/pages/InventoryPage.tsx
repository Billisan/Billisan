import { Search, ShieldCheck, SquareDashed, TriangleAlert, Umbrella } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { usePendingInspectionBySlot } from '@/features/inspections/hooks/useInspections';
import { DetailLink } from '@/features/stations/components/DetailLink';
import { useInventory, useStationSlots } from '@/features/stations/hooks/useStations';
import { MOCK_STATIONS, STATIONS_SYNCED_AT } from '@/features/stations/mocks/stations';
import {
    deriveSlotDisplayStatus,
    formatSlotLabel,
    formatUpdatedAt,
    SLOT_DISPLAY_TONE,
    slotStatusHint,
    slotStatusText,
    type SlotDisplayStatus,
    type Station,
} from '@/features/stations/types';
import { Badge } from '@/shared/components/Badge';
import { FilterSelect, type FilterOption } from '@/shared/components/FilterSelect';
import { ErrorState, LoadingState } from '@/shared/components/PageState';
import { PageBar } from '@/shared/components/PageBar';
import { PageTitle } from '@/shared/components/PageTitle';
import { ROW_CLICKABLE, useRowNavigate } from '@/shared/hooks/useRowNavigate';
import { SLOT_DISPLAY_LABEL } from '@/shared/constants/statusLabels';
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
    'ALL' | Extract<SlotDisplayStatus, 'AVAILABLE' | 'EMPTY' | 'ADMIN_REVIEW' | 'DAMAGED'>;

/**
 * §7.5 의 필터 목록에서 '건조 중'을 뺀 것입니다.
 * `DRYING` 은 DB Enum 이 아니고 채택 전까지 미표시입니다 (WF-WEB-CHANGE-004 · DEC-WEB-001).
 */
const STATUS_OPTIONS: readonly FilterOption<StatusFilter>[] = [
    { value: 'ALL', label: '우산 상태' },
    /*
     * 라벨을 손으로 적지 않고 공용 매핑에서 가져옵니다.
     * `AVAILABLE` 을 '사용 가능'이라고 따로 적어 뒀었는데, 표의 배지는 '이용 가능'이라
     * 같은 상태가 필터와 표에서 다른 이름으로 보였습니다.
     */
    { value: 'AVAILABLE', label: SLOT_DISPLAY_LABEL.AVAILABLE },
    { value: 'EMPTY', label: SLOT_DISPLAY_LABEL.EMPTY },
    { value: 'ADMIN_REVIEW', label: SLOT_DISPLAY_LABEL.ADMIN_REVIEW },
    { value: 'DAMAGED', label: SLOT_DISPLAY_LABEL.DAMAGED },
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

export function InventoryPage() {
    // 행 아무 데나 눌러도 슬롯 상세로 (이력·대여소 표와 같은 규칙)
    const rowNavigate = useRowNavigate();
    // 확정된 조회 조건은 URL Query 에만 둡니다 (화면흐름 §6.2).
    const [searchParams, setSearchParams] = useSearchParams();
    const stationId = parseStation(searchParams.get('station'));
    const keyword = searchParams.get('q')?.trim() ?? '';
    const status = parseStatus(searchParams.get('status'));

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
    const inventoryQuery = useInventory(stationId);
    const slotsQuery = useStationSlots(stationId);
    /*
     * `ACT-WEB-INVENTORY-004` 검수 상세 이동에 필요한 slotId → inspectionId.
     * ADMIN-SLOT-001 에 검수 정보가 없어서 ADMIN-INSPECTION-001 로 대신 채웁니다.
     */
    const pendingBySlot = usePendingInspectionBySlot();
    const summary = inventoryQuery.data;
    const slotPage = slotsQuery.data;
    const allSlots = useMemo(() => slotPage?.items ?? [], [slotPage]);

    const slots = useMemo(() => {
        const normalized = keyword.toLowerCase();
        /*
         * 검색 대상은 **사람이 칠 수 있는 값**뿐입니다 — 슬롯 표시 라벨('SL-03-01')과
         * 대여소 이름·코드. `slotId`·`stationId` 는 UUID 라 검색에 넣지 않습니다.
         *
         * 이 화면은 대여소를 드롭다운으로 이미 고른 뒤라 대여소로 검색해도 결과가 전부
         * 남거나 전부 사라집니다. 그래도 넣어 두는 이유는 표에 '대여소' 열이 보이기
         * 때문입니다 — 보이는 값으로 걸러지지 않으면 검색이 고장 난 것처럼 보입니다.
         * 대여소를 넘나드는 검색은 P0 API 가 대여소 단위라(`ADMIN-SLOT-001`) 불가능합니다.
         */
        const stationText = `${station.name} ${station.stationCode}`.toLowerCase();

        return allSlots.filter((slot) => {
            const label = formatSlotLabel(station.stationCode, slot.slotNumber).toLowerCase();
            const matchesKeyword =
                !normalized || label.includes(normalized) || stationText.includes(normalized);
            const matchesStatus = status === 'ALL' || deriveSlotDisplayStatus(slot) === status;

            return matchesKeyword && matchesStatus;
        });
    }, [allSlots, keyword, status, station.name, station.stationCode]);

    /*
     * 집계는 `ADMIN-INVENTORY-001` 필드 그대로입니다.
     * '대여 중' 집계는 없습니다 — 관리자 API 는 활성 대여를 노출하지 않습니다.
     * 명세 주석: "집계 항목은 서로 겹칠 수 있으므로 모든 count를 단순 합산하지 않는다."
     */
    const counts = {
        available: summary?.availableUmbrellaCount ?? 0,
        empty: summary?.emptySlotCount ?? 0,
        review: summary?.adminReviewSlotCount ?? 0,
        damaged: summary?.damagedUmbrellaCount ?? 0,
        total: summary?.totalSlotCount ?? 0,
    };

    // 대여소당 SLOT 이 3~5개라 페이지를 나누지 않습니다 (ADMIN-SLOT-001 도 cursor 없음).
    const rows = slots;

    const applyQuery = (next: { station: string; keyword: string; status: StatusFilter }) => {
        const params = new URLSearchParams();
        if (next.station !== MOCK_STATIONS[0].stationId) params.set('station', next.station);
        if (next.keyword) params.set('q', next.keyword);
        if (next.status !== 'ALL') params.set('status', next.status);
        setSearchParams(params);
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        applyQuery({
            station: stationInput,
            keyword: keywordInput.trim(),
            status: statusInput,
        });
    };

    return (
        <div>
            <PageBar className="mb-[18px]" meta={`${STATIONS_SYNCED_AT} 기준`} />

            {/*
             * 조회 줄은 **왼쪽에 즉시 반영되는 것, 오른쪽에 눌러야 하는 것** 순서입니다.
             * 드롭다운은 고르는 순간 적용되고 `조회` 는 검색어 하나만 확정하므로,
             * 검색칸과 버튼을 붙여 두어야 그 둘이 한 벌이라는 게 보입니다.
             */}
            <form onSubmit={handleSubmit} className="mb-[22px] flex items-center gap-3">
                <PageTitle className="mr-auto">우산 재고</PageTitle>

                {/*
                 * P0 API 가 대여소 단위라 이 선택이 필수입니다. '전체'는 둘 수 없습니다.
                 *
                 * 드롭다운은 **고르는 즉시 반영**합니다. 고른 뒤 '조회'를 또 눌러야 하면
                 * 화면과 선택값이 어긋난 상태가 남습니다. `002 조회` 는 타이핑이 필요한
                 * 검색어 몫으로 두고, `001 상태 탭 변경` 처럼 선택 자체가 액션인 것은
                 * 바로 적용합니다 (화면흐름 §7.5).
                 */}
                <FilterSelect
                    label="대여소"
                    value={stationInput}
                    onChange={(next) => {
                        setStationInput(next);
                        applyQuery({ station: next, keyword, status });
                    }}
                    options={STATION_OPTIONS}
                    className="w-[150px]"
                />

                <FilterSelect
                    label="우산 상태 필터"
                    value={statusInput}
                    onChange={(next) => {
                        setStatusInput(next);
                        applyQuery({ station: stationId, keyword, status: next });
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

            {/* 집계 카드 — 시안 기준 227x96, 간격 16 */}
            <div className="mb-4 grid grid-cols-4 gap-4">
                <StatCard
                    tone="green"
                    icon={<Umbrella className="size-[17px]" strokeWidth={2.1} aria-hidden />}
                    label="대여 가능 재고"
                    value={counts.available}
                    sub={`전체 ${counts.total}`}
                />
                {/*
                 * '대여 중' 카드는 뺐습니다. `ADMIN-INVENTORY-001` 에 그런 집계가 없고,
                 * 관리자 API 어디에도 활성 대여가 노출되지 않습니다. 우산이 나가 있는 슬롯은
                 * 서버 기준으로도 빈 슬롯입니다.
                 */}
                {/*
                 * 빈 슬롯은 **회색**입니다. 표·배지·상태 변경 모달의 '빈 슬롯' 이 전부
                 * `SLOT_DISPLAY_TONE.EMPTY = 'slate'` 인데 이 카드만 파랑이면 같은 상태가
                 * 화면마다 다른 색으로 보입니다. 게다가 파랑은 조회 버튼·링크에 쓰는
                 * 동작 색이라, 아무 일도 없는 상태에 쓰면 눌러야 할 것처럼 보입니다.
                 *
                 * 아이콘도 바꿨습니다. 예전 `LogOut` 은 헤더의 **로그아웃**과 같은 그림이라
                 * 뜻이 겹쳤습니다. 점선 사각형이 '우산이 빠진 빈 칸'에 그대로 맞습니다.
                 */}
                <StatCard
                    tone="slate"
                    icon={<SquareDashed className="size-[17px]" strokeWidth={2.1} aria-hidden />}
                    label="빈 슬롯"
                    value={counts.empty}
                    sub="반납 가능"
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
                <div className="grid h-[42px] grid-cols-[172px_220px_183px_216px_112px] items-center bg-brand-surface pl-[14px] pr-[39px] text-[11.5px] font-bold text-brand-body">
                    <span>slotId</span>
                    <span>대여소</span>
                    <span className="text-center">상태</span>
                    <span>최근 상태 변경</span>
                    <span />
                </div>

                {rows.length > 0 ? (
                    rows.map((slot, index) => {
                        const display = deriveSlotDisplayStatus(slot);
                        // 이 슬롯에 걸린 미처리 검수. 없으면 검수 버튼을 그리지 않습니다.
                        const pendingInspectionId = pendingBySlot.get(slot.slotId);
                        /*
                         * 막대는 **관리자가 아직 할 일이 남은 슬롯에만** 답니다.
                         * `DAMAGED` 는 판정이 끝난 결과라 빼고, 판정을 기다리는
                         * `ADMIN_REVIEW` 만 표시합니다. 대여소 상세 슬롯 표와 같은 규칙입니다.
                         */
                        const accent = display === 'ADMIN_REVIEW' ? 'bg-tone-amber-fg' : null;

                        return (
                            /*
                             * 행 아무 데나 눌러도 슬롯 상세로 갑니다 — 대여소 표(`Tr`)와 같은
                             * 규칙입니다. 행 안의 링크(`검수`·`상세`)는 자기 목적지로 가고,
                             * 글자를 드래그해 고른 것뿐이면 이동하지 않습니다.
                             *
                             * 키보드는 행이 아니라 행 안의 링크로 다닙니다. 눌러야 하는 것이
                             * 이미 링크로 있어서 행에 별도 tabIndex 를 주면 탭 순서만 두 배가
                             * 됩니다. 행 클릭은 마우스 편의 장치입니다.
                             */
                            <div
                                key={slot.slotId}
                                onClick={rowNavigate(`/slots/${slot.slotId}`)}
                                className={cn(
                                    'relative grid h-[42.9px] grid-cols-[172px_220px_183px_216px_112px] items-center pl-[14px] pr-[39px] text-[12.5px]',
                                    ROW_CLICKABLE,
                                )}
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
                                        title={slotStatusHint(display)}
                                    >
                                        {slotStatusText(display)}
                                    </Badge>
                                </span>
                                <span className="font-medium tabular-nums text-brand-ink-soft">
                                    {formatUpdatedAt(slot.updatedAt)}
                                </span>
                                <span className="flex items-center justify-center">
                                    {/*
                                     * 행마다 버튼은 **하나**입니다. 그 행이 지금 필요로 하는 것만
                                     * 내놓습니다 — 판정을 기다리면 `검수`, 아니면 `상세`.
                                     *
                                     * §7.5 의 `ACT-WEB-INVENTORY-003 상세 이동` 과
                                     * `004 검수 상세 이동` 둘 다 살아 있습니다. 두 화면이 서로
                                     * 연결돼 있어서(검수 상세 → '슬롯 상세', 슬롯 상세 → '검수하기')
                                     * 어느 쪽으로 들어가도 반대편에 닿습니다.
                                     *
                                     * `ACT-WEB-INVENTORY-004` 대상은 `ADMIN-SLOT-001` 응답만으로는
                                     * 알 수 없습니다(검수 정보가 없음). 미처리 검수 목록을 슬롯
                                     * 기준으로 뒤집어 둔 매핑에서 찾고, 없으면 `상세` 로 둡니다 —
                                     * 틀린 곳으로 보내지 않습니다.
                                     */}
                                    {pendingInspectionId ? (
                                        <Link
                                            to={`/inspections/${pendingInspectionId}`}
                                            className="inline-flex h-[24px] items-center rounded-[6px] bg-tone-amber-fg px-[10px] text-[11px] font-bold text-white transition-opacity hover:opacity-85"
                                        >
                                            검수
                                        </Link>
                                    ) : (
                                        <DetailLink to={`/slots/${slot.slotId}`} />
                                    )}
                                </span>
                            </div>
                        );
                    })
                ) : slotsQuery.isPending ? (
                    <LoadingState />
                ) : slotsQuery.isError ? (
                    <ErrorState error={slotsQuery.error} onRetry={() => slotsQuery.refetch()} />
                ) : (
                    <div className="flex h-[200px] items-center justify-center text-[13px] font-medium text-brand-muted">
                        조건에 맞는 슬롯이 없습니다.
                    </div>
                )}
            </div>

            <p className="mt-[22px] text-xs font-semibold text-brand-body">
                전체 {rows.length}개 슬롯
            </p>
        </div>
    );
}

/**
 * 카드 톤. **배지에 쓰는 톤 이름과 같은 것을 씁니다** — 같은 상태가 카드와 표에서 다른
 * 색으로 보이면 안 되니까요 (`SLOT_DISPLAY_TONE` 참고).
 */
const CARD_TONE = {
    green: { chip: 'bg-tone-green-bg text-tone-green-fg', value: 'text-tone-green-fg' },
    slate: { chip: 'bg-tone-slate-bg text-tone-slate-fg', value: 'text-tone-slate-fg' },
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
