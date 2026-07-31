import { Link } from 'react-router-dom';

import { Panel, PanelHeader } from '@/features/dashboard/components/Panel';
import { MapBackdrop } from '@/features/map/components/MapBackdrop';
import { PanelState } from '@/features/dashboard/components/PanelState';
import { useStations } from '@/features/stations/hooks/useStations';
import {
    getStationStatus,
    LEGEND_STATUSES,
    STATION_STATUS_META,
    type Station,
} from '@/features/stations/types';
import { CAMPUS_NAME } from '@/shared/constants/organization';
import { cn } from '@/lib/utils';

function MapLegend() {
    return (
        <div className="absolute left-[14px] top-[12px] flex h-9 items-center gap-[6px] rounded-[7px] bg-white px-[14px]">
            {LEGEND_STATUSES.map((status) => {
                const meta = STATION_STATUS_META[status];
                return (
                    <span key={status} className="flex items-center gap-[9px]">
                        <span className={cn('size-[9px] rounded-full', meta.bg)} aria-hidden />
                        <span className="text-[10.5px] font-semibold text-brand-body">
                            {meta.label}
                        </span>
                    </span>
                );
            })}
        </div>
    );
}

function StationMarker({ station }: { station: Station }) {
    const status = getStationStatus(station);
    const meta = STATION_STATUS_META[status];
    const isOffline = status === 'OFFLINE';

    const summary = isOffline
        ? `${station.name} · 오프라인`
        : `${station.name} · 사용 가능 ${station.available} / ${station.capacity} (${meta.label})`;

    /*
     * 마커를 눌러 대여소 상세로 갑니다.
     *
     * 지도 배경은 아직 도형이고 좌표도 목업입니다(ERD v3.0 STATION 에 위도·경도 컬럼이
     * 없습니다). 그래도 **어느 대여소인지는 `stationId` 하나로 정해지므로** 상세로 가는
     * 동선은 좌표 없이도 성립합니다. 지도 SDK 로 배경만 갈아 끼울 때 이 링크는 그대로 씁니다.
     *
     * `button` 이 아니라 `Link` 입니다 — 새 탭으로 열기·주소 복사가 되고, 스크린리더도
     * "이동" 으로 읽습니다.
     */
    return (
        <Link
            to={`/stations/${station.stationId}`}
            className="absolute flex -translate-x-1/2 -translate-y-[15px] flex-col items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
            style={{ left: `${station.position.x}%`, top: `${station.position.y}%` }}
            title={summary}
        >
            {/* 마커 안의 숫자만으로는 무엇인지 알 수 없어서 읽을 이름을 따로 둡니다. */}
            <span className="sr-only">{summary}</span>
            <span
                className={cn(
                    'flex size-[30px] items-center justify-center rounded-full border-[2.6px] border-white text-[10.5px] font-extrabold text-white transition-transform hover:scale-110',
                    meta.bg,
                )}
                aria-hidden
            >
                {isOffline ? 'OFF' : station.available}
            </span>
            <span
                className="mt-[3px] whitespace-nowrap text-[11px] font-semibold leading-[14px] text-brand-body"
                aria-hidden
            >
                {station.name}
            </span>
        </Link>
    );
}

export function StationMapCard({ className }: { className?: string }) {
    const { data, isPending, isError, refetch } = useStations();
    const stations = data ?? [];

    return (
        <Panel className={cn('p-[18px]', className)}>
            <PanelHeader
                title="대여소 분포 · 실시간 현황"
                meta={
                    // 못 불러왔을 때 '0개소' 라고 쓰면 대여소가 없다는 뜻이 됩니다.
                    isPending || isError
                        ? `${CAMPUS_NAME} 캠퍼스`
                        : `${CAMPUS_NAME} 캠퍼스 · ${stations.length}개소`
                }
                className="px-0.5 pb-[12px]"
            />

            <div className="relative flex min-h-[420px] flex-1 overflow-hidden rounded-[7px] bg-map-base">
                <MapBackdrop />
                <MapLegend />
                {stations.map((station) => (
                    <StationMarker key={station.stationId} station={station} />
                ))}
                {/*
                 * 마커가 하나도 없으면 배경 도형만 남아 "대여소가 없는 캠퍼스" 처럼 보입니다.
                 * 조회에 실패했다는 사실과 이 영역만 다시 시도하는 길을 그 위에 올립니다.
                 */}
                <PanelState
                    pending={isPending}
                    failed={isError}
                    message="대여소 분포를 불러오지 못했습니다"
                    onRetry={() => void refetch()}
                    className="relative z-10 m-auto rounded-[7px] bg-white/90 px-5"
                />
            </div>
        </Panel>
    );
}
