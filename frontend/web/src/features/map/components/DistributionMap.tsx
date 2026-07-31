import { Crosshair } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { MapBackdrop } from '@/features/map/components/MapBackdrop';
import { tallyByStatus } from '@/features/map/lib/distribution';
import {
    centerOffset,
    clampOffset,
    isClick,
    isPannable,
    type Offset,
    type Size,
} from '@/features/map/lib/pan';
import {
    getStationStatus,
    LEGEND_STATUSES,
    STATION_STATUS_META,
    type Station,
} from '@/features/stations/types';
import { cn } from '@/lib/utils';

/**
 * 분포도 — `SCR-WEB-MAP-001` 의 `DEFAULT`·`STATION_SELECTED`.
 *
 * 마커를 눌러 대여소를 고릅니다 (`ACT-WEB-MAP-001`). 대시보드 카드의 마커는 상세로 바로
 * 가는 링크지만, 여기서는 **고르는 동작**입니다 — 옆 패널에 요약이 뜨고 분포 안에서
 * 비교를 이어갈 수 있어야 해서, 화면을 떠나는 링크로 두지 않았습니다.
 *
 * **캔버스를 고정 크기로 두고 끌어서 봅니다.** 화면 폭에 맞춰 도식을 늘이면 넓은 화면에서
 * 도로와 블록이 가로로 납작해집니다. 크기를 고정하면 가로세로비가 항상 같고, 화면에 다
 * 안 들어오는 만큼은 끌어서 봅니다.
 */

/**
 * 도식 캔버스 크기 (px).
 *
 * 보이는 영역(높이 520)보다 큽니다. 대여소가 8개뿐이라 더 키우면 마커 사이가 허전해지고,
 * 더 줄이면 마커 이름표가 겹칩니다.
 */
const CANVAS: Size = { width: 1240, height: 860 };

/** 방향키 한 번에 움직이는 거리 (px). Shift 를 누르면 4배입니다. */
const KEY_STEP_PX = 56;

function StationMarker({
    station,
    selected,
    onSelect,
}: {
    station: Station;
    selected: boolean;
    onSelect: () => void;
}) {
    const status = getStationStatus(station);
    const meta = STATION_STATUS_META[status];
    const isOffline = status === 'OFFLINE';

    const summary = isOffline
        ? `${station.name} · 오프라인`
        : `${station.name} · 사용 가능 ${station.available} / ${station.capacity} (${meta.label})`;

    return (
        <button
            type="button"
            onClick={onSelect}
            // 눌린 상태를 보조기기에도 알립니다. 색만으로는 선택 여부가 전달되지 않습니다.
            aria-pressed={selected}
            className="absolute flex -translate-x-1/2 -translate-y-[15px] flex-col items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
            style={{ left: `${station.position.x}%`, top: `${station.position.y}%` }}
            title={summary}
        >
            <span className="sr-only">{summary}</span>
            <span
                className={cn(
                    'flex size-[30px] items-center justify-center rounded-full border-[2.6px] text-[10.5px] font-extrabold text-white transition-transform',
                    meta.bg,
                    // 선택된 마커는 테두리를 진하게 하고 키웁니다. 색은 상태를 뜻하므로 건드리지 않습니다.
                    selected
                        ? 'scale-125 border-brand-ink shadow-[0_2px_8px_rgba(11,18,32,0.28)]'
                        : 'border-white hover:scale-110',
                )}
                aria-hidden
            >
                {isOffline ? 'OFF' : station.available}
            </span>
            <span
                className={cn(
                    'mt-[3px] whitespace-nowrap text-[11px] leading-[14px]',
                    selected ? 'font-extrabold text-brand-ink' : 'font-semibold text-brand-body',
                )}
                aria-hidden
            >
                {station.name}
            </span>
        </button>
    );
}

/** 범례에 상태별 개수를 붙입니다. 색만 있으면 "몇 곳이 부족한지"를 세어야 합니다. */
function MapLegend({ stations }: { stations: readonly Station[] }) {
    const tally = tallyByStatus(stations);

    return (
        <div className="pointer-events-none absolute left-[14px] top-[12px] z-10 flex h-9 items-center gap-[14px] rounded-[7px] bg-white/95 px-[14px]">
            {LEGEND_STATUSES.map((status) => {
                const meta = STATION_STATUS_META[status];
                return (
                    <span key={status} className="flex items-center gap-[7px]">
                        <span className={cn('size-[9px] rounded-full', meta.bg)} aria-hidden />
                        <span className="text-[10.5px] font-semibold text-brand-body">
                            {meta.label} {tally[status]}
                        </span>
                    </span>
                );
            })}
            {tally.OFFLINE > 0 && (
                <span className="flex items-center gap-[7px]">
                    <span
                        className={cn('size-[9px] rounded-full', STATION_STATUS_META.OFFLINE.bg)}
                        aria-hidden
                    />
                    <span className="text-[10.5px] font-semibold text-brand-body">
                        오프라인 {tally.OFFLINE}
                    </span>
                </span>
            )}
        </div>
    );
}

export function DistributionMap({
    stations,
    selectedId,
    onSelect,
    className,
}: {
    stations: readonly Station[];
    selectedId: string | null;
    onSelect: (stationId: string) => void;
    className?: string;
}) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
    const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);

    /** 끌기 시작점. 렌더를 유발할 필요가 없어 ref 에 둡니다. */
    const drag = useRef<{ pointer: Offset; origin: Offset } | null>(null);
    /** 끌고 난 직후의 click 을 한 번 삼킵니다 (아래 onClickCapture 참고). */
    const suppressClick = useRef(false);

    // 보이는 영역 크기를 재고, 창 크기가 바뀌면 다시 잽니다.
    useLayoutEffect(() => {
        const element = viewportRef.current;
        if (!element) return;

        const measure = () =>
            setViewport({ width: element.clientWidth, height: element.clientHeight });

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    // 크기를 처음 알게 된 시점(그리고 창이 바뀔 때)에 가운데로 맞춥니다.
    useEffect(() => {
        if (viewport.width === 0) return;
        setOffset((current) =>
            current.x === 0 && current.y === 0
                ? centerOffset(viewport, CANVAS)
                : clampOffset(current, viewport, CANVAS),
        );
    }, [viewport]);

    const pannable = viewport.width > 0 && isPannable(viewport, CANVAS);

    const moveBy = useCallback(
        (dx: number, dy: number) =>
            setOffset((current) =>
                clampOffset({ x: current.x + dx, y: current.y + dy }, viewport, CANVAS),
            ),
        [viewport],
    );

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        /*
         * 새 동작이 시작됐으니 앞선 끌기가 남긴 억제 표시를 지웁니다.
         *
         * 이게 없으면 표시가 계속 살아 있습니다. 끌기의 click 은 pointerup 바로 뒤에
         * 오는데, 커서를 영역 밖에서 떼면 그 click 이 아예 안 옵니다. 그러면 표시가
         * 남아서 **그다음에 누르는 것**을 대신 먹습니다 — 끌고 나서 마커를 누르면
         * 선택이 안 되고, 「처음 위치」도 한 번 무시됩니다.
         */
        suppressClick.current = false;

        // 왼쪽 버튼만. 오른쪽·가운데 버튼으로 끌리면 상황 메뉴와 겹칩니다.
        if (!pannable || event.button !== 0) return;

        /*
         * 브라우저의 기본 끌기(이미지·텍스트 선택)를 막습니다.
         *
         * 이게 없으면 두 번째 끌기부터 `pointercancel` 이 날아옵니다. 첫 `pointermove`
         * 하나만 반영되고 나머지가 통째로 버려져서, 440px 을 끌어도 44px 만 움직였습니다.
         * 눈으로는 "가끔 안 끌리는" 것처럼 보이는 종류라 원인을 잡기 어려웠습니다.
         */
        event.preventDefault();

        drag.current = {
            pointer: { x: event.clientX, y: event.clientY },
            origin: offset,
        };
        setDragging(true);
    };

    /*
     * 끌기 중에는 **window** 에 붙입니다.
     *
     * 예전에는 컨테이너의 `onPointerMove` + `setPointerCapture` 를 썼는데, 캡처가 풀리거나
     * `pointercancel` 이 나면 중간에 조용히 끊겼습니다. window 리스너는 커서가 어디로 가든
     * 따라오고, 다른 요소가 이벤트를 가로채지 못합니다.
     */
    useEffect(() => {
        if (!dragging) return;

        const onMove = (event: PointerEvent) => {
            const start = drag.current;
            if (!start) return;
            setOffset(
                clampOffset(
                    {
                        x: start.origin.x + (event.clientX - start.pointer.x),
                        y: start.origin.y + (event.clientY - start.pointer.y),
                    },
                    viewport,
                    CANVAS,
                ),
            );
        };

        const onUp = (event: PointerEvent) => {
            const start = drag.current;
            drag.current = null;
            setDragging(false);
            if (!start) return;
            /*
             * 끌고 나서 손을 떼면 브라우저가 click 을 마저 발생시킵니다. 마커 위에서
             * 끝나면 엉뚱한 대여소가 선택되므로, 움직인 거리가 클릭으로 보기 어려우면
             * 다음 click 을 한 번 삼킵니다. 손떨림(4px 미만)은 클릭으로 살려 둡니다.
             */
            suppressClick.current = !isClick(start.pointer, { x: event.clientX, y: event.clientY });
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, [dragging, viewport]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!pannable) return;
        const step = event.shiftKey ? KEY_STEP_PX * 4 : KEY_STEP_PX;
        const move: Record<string, [number, number]> = {
            ArrowLeft: [step, 0],
            ArrowRight: [-step, 0],
            ArrowUp: [0, step],
            ArrowDown: [0, -step],
        };
        const delta = move[event.key];
        if (!delta) return;
        // 방향키로 페이지가 같이 스크롤되면 지도만 움직이려던 의도가 깨집니다.
        event.preventDefault();
        moveBy(delta[0], delta[1]);
    };

    return (
        <div
            ref={viewportRef}
            role="group"
            aria-label="대여소 분포"
            /*
             * 방향키를 받으려면 영역이 포커스를 가질 수 있어야 합니다. 끌 수 없을 만큼
             * 화면이 넓으면 탭 순서에서 빼 둡니다 — 아무 일도 안 하는 정거장이 됩니다.
             */
            tabIndex={pannable ? 0 : -1}
            className={cn(
                'relative h-[520px] overflow-hidden rounded-[7px] bg-map-base',
                // 끌 때 글자·이미지가 선택되면 파란 블록이 생기고 끌기가 끊깁니다.
                pannable && 'touch-none select-none',
                pannable && (dragging ? 'cursor-grabbing' : 'cursor-grab'),
                className,
            )}
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
            onClickCapture={(event) => {
                if (!suppressClick.current) return;
                suppressClick.current = false;
                event.stopPropagation();
                event.preventDefault();
            }}
        >
            <MapLegend stations={stations} />

            {pannable && (
                <div className="pointer-events-none absolute bottom-[12px] left-[14px] z-10 rounded-[6px] bg-white/95 px-[10px] py-[5px] text-[10.5px] font-semibold text-brand-muted">
                    끌어서 이동 · 방향키로도 움직입니다
                </div>
            )}

            {pannable && (
                <button
                    type="button"
                    onClick={() => setOffset(centerOffset(viewport, CANVAS))}
                    className="absolute right-[12px] top-[12px] z-10 flex h-9 items-center gap-[6px] rounded-[7px] bg-white/95 px-[12px] text-[11.5px] font-bold text-brand-body transition-colors hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                >
                    <Crosshair className="size-[13px]" aria-hidden />
                    처음 위치
                </button>
            )}

            {/*
             * 배경과 마커를 **같은 상자 안에** 두고 통째로 옮깁니다. 따로 움직이면 마커가
             * 길 위에 있다가 블록 위로 미끄러집니다.
             */}
            <div
                className={cn('absolute left-0 top-0', !dragging && 'transition-transform')}
                style={{
                    width: CANVAS.width,
                    height: CANVAS.height,
                    transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
                }}
            >
                <MapBackdrop />
                {stations.map((station) => (
                    <StationMarker
                        key={station.stationId}
                        station={station}
                        selected={station.stationId === selectedId}
                        onSelect={() => onSelect(station.stationId)}
                    />
                ))}
            </div>
        </div>
    );
}
