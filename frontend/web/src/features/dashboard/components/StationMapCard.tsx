import { Panel, PanelHeader } from '@/features/dashboard/components/Panel';
import { MOCK_STATIONS } from '@/features/stations/mocks/stations';
import {
    getStationStatus,
    LEGEND_STATUSES,
    STATION_STATUS_META,
    type Station,
} from '@/features/stations/types';
import { CAMPUS_NAME } from '@/shared/constants/organization';
import { cn } from '@/lib/utils';

/**
 * 지도 배경 플레이스홀더.
 * 실제 지도 SDK 붙이기 전까지 쓰는 도형이며, 좌표는 시안 좌표계를 그대로 씁니다.
 * TODO: 지도 SDK(카카오/네이버) 연동 시 이 컴포넌트만 교체하면 마커는 그대로 재사용됩니다.
 */
function MapBackdrop() {
    return (
        <svg
            className="absolute inset-0 size-full"
            viewBox="306 184 606 562"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden
            focusable="false"
        >
            <rect x="306" y="184" width="606" height="562" fill="#EAEDF0" />
            {/* 도로 */}
            <rect x="286" y="540" width="646" height="26" rx="13" fill="#FFFFFF" />
            <rect x="286" y="438" width="646" height="20" rx="10" fill="#FFFFFF" />
            <rect x="286" y="709" width="646" height="20" rx="10" fill="#FFFFFF" />
            <rect x="518" y="164" width="26" height="602" rx="13" fill="#FFFFFF" />
            <rect x="714" y="164" width="20" height="602" rx="10" fill="#FFFFFF" />
            {/* 블록 */}
            <rect x="334" y="580" width="160" height="120" rx="24" fill="#DCEEDD" />
            <rect x="758" y="244" width="140" height="120" rx="40" fill="#D7E8F7" />
            <rect x="556" y="244" width="80" height="56" rx="10" fill="#E2E5E9" />
            <rect x="758" y="654" width="70" height="48" rx="10" fill="#E2E5E9" />
        </svg>
    );
}

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

    return (
        <button
            type="button"
            className="absolute flex -translate-x-1/2 -translate-y-[15px] flex-col items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
            style={{ left: `${station.position.x}%`, top: `${station.position.y}%` }}
            title={
                isOffline
                    ? `${station.name} · 오프라인`
                    : `${station.name} · 사용 가능 ${station.available} / ${station.capacity} (${meta.label})`
            }
            // TODO: 클릭 시 대여소 상세로 이동 (/stations/:id)
        >
            <span
                className={cn(
                    'flex size-[30px] items-center justify-center rounded-full border-[2.6px] border-white text-[10.5px] font-extrabold text-white transition-transform hover:scale-110',
                    meta.bg,
                )}
            >
                {isOffline ? 'OFF' : station.available}
            </span>
            <span className="mt-[3px] whitespace-nowrap text-[11px] font-semibold leading-[14px] text-brand-body">
                {station.name}
            </span>
        </button>
    );
}

export function StationMapCard({ className }: { className?: string }) {
    return (
        <Panel className={cn('p-[18px]', className)}>
            <PanelHeader
                title="대여소 분포 · 실시간 현황"
                meta={`${CAMPUS_NAME} 캠퍼스 · ${MOCK_STATIONS.length}개소`}
                className="px-0.5 pb-[12px]"
            />

            <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-[7px] bg-map-base">
                <MapBackdrop />
                <MapLegend />
                {MOCK_STATIONS.map((station) => (
                    <StationMarker key={station.id} station={station} />
                ))}
            </div>
        </Panel>
    );
}
