import { Panel, PanelHeader } from '@/features/dashboard/components/Panel';
import { PanelState } from '@/features/dashboard/components/PanelState';
import { useStations } from '@/features/stations/hooks/useStations';
import {
    getStationStatus,
    isDeviceOnline,
    sortByStock,
    STATION_STATUS_META,
    type Station,
} from '@/features/stations/types';
import { cn } from '@/lib/utils';

function StockRow({ station }: { station: Station }) {
    const status = getStationStatus(station);
    const meta = STATION_STATUS_META[status];
    const isOffline = status === 'OFFLINE';
    const ratio = station.capacity > 0 ? station.available / station.capacity : 0;

    return (
        <li>
            {/* 두 span 모두 leading 을 고정해야 행 높이가 48px 로 일정해집니다.
                (임의 크기 text-[11.5px] 는 line-height 가 딸려오지 않아 행이 1.25px 씩 늘어남) */}
            <div className="flex items-baseline justify-between gap-2">
                <span
                    className={cn(
                        'truncate text-xs font-semibold leading-4',
                        isOffline ? 'text-status-offline-text' : 'text-brand-body',
                    )}
                >
                    {station.name}
                </span>
                <span
                    className={cn(
                        'shrink-0 text-[11.5px] font-bold leading-4 tabular-nums',
                        isOffline && 'text-status-offline-text',
                        status === 'SHORTAGE' && 'text-status-shortage',
                        status !== 'SHORTAGE' && !isOffline && 'text-brand-ink',
                    )}
                >
                    {isOffline ? 'OFF' : `${station.available} / ${station.capacity}`}
                </span>
            </div>
            <div
                className="mt-[5px] h-1.5 overflow-hidden rounded-full bg-brand-track"
                role="progressbar"
                aria-label={`${station.name} 재고`}
                aria-valuemin={0}
                aria-valuemax={station.capacity}
                aria-valuenow={isOffline ? undefined : station.available}
            >
                {!isOffline && (
                    <div
                        className={cn('h-full rounded-full', meta.bg)}
                        style={{ width: `${Math.min(100, ratio * 100)}%` }}
                    />
                )}
            </div>
        </li>
    );
}

export function StationStockCard({ className }: { className?: string }) {
    const { data, isPending, isError, refetch } = useStations();
    const stations = data ?? [];
    const ranked = sortByStock(stations);
    const shortageCount = ranked.filter((s) => getStationStatus(s) === 'SHORTAGE').length;
    const offlineCount = ranked.filter((s) => !isDeviceOnline(s)).length;

    return (
        <Panel className={cn('p-5', className)}>
            <PanelHeader
                title="대여소 재고 순위"
                meta="사용 가능 / 전체"
                metaClassName="text-[10.5px]"
            />

            <div className="mt-[8px] h-px shrink-0 bg-brand-line-soft" />

            {/* 카드가 시안(476px)보다 짧아지면 목록만 스크롤되게 해서 푸터가 밀려나지 않도록 */}
            <ul className="mt-[14px] flex min-h-0 flex-1 flex-col gap-[21px] overflow-y-auto">
                {ranked.map((station) => (
                    <StockRow key={station.stationId} station={station} />
                ))}
                {(isPending || isError) && (
                    <li>
                        {/* 실패하면 이 카드만 다시 조회합니다 (화면흐름 §16) */}
                        <PanelState
                            pending={isPending}
                            failed={isError}
                            message="재고를 불러오지 못했습니다"
                            onRetry={() => void refetch()}
                        />
                    </li>
                )}
            </ul>

            <div className="shrink-0 pt-[6px]">
                <div className="h-px bg-brand-line-soft" />
                {/*
                 * 못 불러왔을 때 '부족 0개소' 라고 쓰면 안 됩니다. 관리자는 그걸 "부족한
                 * 대여소가 없다" 로 읽는데, 실제로는 아무것도 모르는 상태입니다.
                 * 틀린 숫자는 없는 숫자보다 나쁩니다.
                 */}
                <p className="pt-[9px] text-[10.5px] font-medium text-brand-muted">
                    {isPending || isError
                        ? '부족·오프라인 집계 없음'
                        : `부족 ${shortageCount}개소 · 오프라인 ${offlineCount}개소`}
                </p>
            </div>
        </Panel>
    );
}
