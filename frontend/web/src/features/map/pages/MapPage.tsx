import { List, Map as MapIcon, RotateCw } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { DistributionList } from '@/features/map/components/DistributionList';
import { DistributionMap } from '@/features/map/components/DistributionMap';
import { SelectedStationPanel } from '@/features/map/components/SelectedStationPanel';
import { useStations } from '@/features/stations/hooks/useStations';
import { STATIONS_SYNCED_AT } from '@/features/stations/mocks/stations';
import { CAMPUS_NAME } from '@/shared/constants/organization';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/PageState';
import { PageBar } from '@/shared/components/PageBar';
import { PageTitle } from '@/shared/components/PageTitle';
import { cn } from '@/lib/utils';

/**
 * 지도·분포도 — `SCR-WEB-MAP-001` (화면흐름 §13).
 *
 * 운영 목적은 대여소별 부족·적정·과잉·오프라인 상태를 **공간적으로 비교**하는 것입니다.
 * 목록 화면과 나뉘는 지점이 여기입니다 — 표는 순위를 보여 주고, 이 화면은 **어디가
 * 몰려 있는지**를 보여 줍니다.
 *
 * 다루는 Action 은 셋입니다.
 *   `ACT-WEB-MAP-001` 마커 선택     → 오른쪽 요약 패널
 *   `ACT-WEB-MAP-003` 목록 대체 보기 → 지도/목록 전환
 *   `ACT-WEB-MAP-004` 재고 새로고침
 *
 * **`ACT-WEB-MAP-002` 재배치 추천은 넣지 않았습니다.** 옮길 개수를 정하는 기준
 * (§13 이 말하는 수요 예측·운영 정책)이 아직 없고, 등록 API 도 계약에 없습니다
 * (`OUT_OF_SCOPE` 또는 `DEFERRED_NOT_CONTRACTED`). 근거 없는 숫자를 "추천"이라고 내보내면
 * 그대로 실행될 수 있습니다. 기준이 정해진 뒤에 붙이세요.
 *
 * **날씨는 넣지 않았습니다.** §13 이 데이터에 '날씨 요약'을 적어 두었지만 관리자 Web 이
 * 부를 수 있는 10개 API 에 날씨가 없고(12-R B-1), 외부 날씨 연동은 별도 분류
 * (`EXTERNAL_WEATHER`)입니다. 값이 없는데 칸을 만들면 빈 카드가 남거나 지어낸 숫자가
 * 들어갑니다. 연동이 정해지면 붙이세요.
 *
 * **실제·시뮬레이션 구분도 넣지 못했습니다.** §13 은 범례·배지로 나누라고 하는데,
 * §7.3 이 이미 적어 두었듯 `isSimulated` 에 해당하는 필드가 응답에 없습니다.
 * 구분할 근거가 없어서 표시하지 않습니다 — 임의로 "1번이 실제"라고 정하면 틀린 정보가
 * 화면에 고정됩니다. 백엔드에 필드를 요청해야 합니다.
 */

type ViewMode = 'MAP' | 'LIST';

function parseView(value: string | null): ViewMode {
    return value === 'list' ? 'LIST' : 'MAP';
}

export function MapPage() {
    const query = useStations();
    const stations = useMemo(() => query.data ?? [], [query.data]);

    /*
     * 선택·보기 모드를 URL 에 둡니다 (§6.2: "필터는 URL Query 와 동기화하여 새로고침·
     * 뒤로가기에 유지한다"). 고른 대여소를 남에게 링크로 보낼 수 있어야 합니다.
     */
    const [searchParams, setSearchParams] = useSearchParams();
    const view = parseView(searchParams.get('view'));
    const selectedParam = searchParams.get('station');

    // URL 에 남은 대여소가 지금 목록에 없을 수도 있습니다(삭제·조회 조건 변경).
    const selected = useMemo(
        () => stations.find((station) => station.stationId === selectedParam) ?? null,
        [stations, selectedParam],
    );

    const applyQuery = (next: { view: ViewMode; station: string | null }) => {
        const params = new URLSearchParams();
        if (next.view === 'LIST') params.set('view', 'list');
        if (next.station) params.set('station', next.station);
        setSearchParams(params);
    };

    const select = (stationId: string) =>
        // 같은 마커를 다시 누르면 선택이 풀립니다.
        applyQuery({ view, station: stationId === selectedParam ? null : stationId });

    return (
        <div>
            <PageBar className="mb-[18px]" meta={`${STATIONS_SYNCED_AT} 기준`} />

            <div className="mb-[22px] flex items-center gap-3">
                <PageTitle className="mr-auto">지도 · 분포도</PageTitle>

                {/* ACT-WEB-MAP-003 — 지도가 멀쩡할 때도 직접 켤 수 있게 둡니다. */}
                <div
                    role="group"
                    aria-label="보기 방식"
                    className="flex h-[38px] items-center gap-1 rounded-[7px] bg-brand-surface p-1"
                >
                    {(
                        [
                            ['MAP', '지도', MapIcon],
                            ['LIST', '목록', List],
                        ] as const
                    ).map(([mode, label, Icon]) => (
                        <button
                            key={mode}
                            type="button"
                            aria-pressed={view === mode}
                            onClick={() => applyQuery({ view: mode, station: selectedParam })}
                            className={cn(
                                'flex h-[30px] items-center gap-[6px] rounded-[5px] px-[13px] text-[12.5px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue',
                                view === mode
                                    ? 'bg-white text-brand-ink shadow-[0_1px_2px_rgba(11,18,32,0.10)]'
                                    : 'text-brand-body hover:text-brand-ink',
                            )}
                        >
                            <Icon className="size-[14px]" aria-hidden />
                            {label}
                        </button>
                    ))}
                </div>

                {/* ACT-WEB-MAP-004 — 날씨는 연동이 없어 재고만 다시 읽습니다. */}
                <button
                    type="button"
                    onClick={() => void query.refetch()}
                    disabled={query.isFetching}
                    className="flex h-[38px] items-center gap-[7px] rounded-[7px] border border-brand-line px-[14px] text-[12.5px] font-bold text-brand-body transition-colors hover:bg-brand-surface disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                >
                    <RotateCw
                        className={cn('size-[14px]', query.isFetching && 'animate-spin')}
                        aria-hidden
                    />
                    재고 새로고침
                </button>
            </div>

            {query.isPending ? (
                <LoadingState />
            ) : query.isError ? (
                <ErrorState error={query.error} onRetry={() => void query.refetch()} />
            ) : stations.length === 0 ? (
                <EmptyState>등록된 대여소가 없습니다.</EmptyState>
            ) : (
                <div className="flex items-start gap-[18px]">
                    <div className="min-w-0 flex-1">
                        {view === 'MAP' ? (
                            <DistributionMap
                                stations={stations}
                                selectedId={selected?.stationId ?? null}
                                onSelect={select}
                            />
                        ) : (
                            <DistributionList
                                stations={stations}
                                selectedId={selected?.stationId ?? null}
                                onSelect={select}
                            />
                        )}

                        <p className="mt-[14px] text-xs font-semibold text-brand-body">
                            {`${CAMPUS_NAME} 캠퍼스 · 대여소 ${stations.length}개소`}
                        </p>
                    </div>

                    {/*
                     * 고른 대여소가 없으면 오른쪽 칸을 아예 두지 않습니다. 빈 칸을 남겨
                     * 두면 "뭔가 있어야 하는데 안 나온" 것처럼 보입니다.
                     */}
                    {selected && (
                        <div className="w-[300px] shrink-0">
                            <SelectedStationPanel
                                station={selected}
                                onClear={() => applyQuery({ view, station: null })}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
