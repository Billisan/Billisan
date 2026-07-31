import { ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import { deficit, formatStockRatio } from '@/features/map/lib/distribution';
import { DeviceBadge } from '@/features/stations/components/DeviceBadge';
import { getStationStatus, STATION_STATUS_META, type Station } from '@/features/stations/types';
import { cn } from '@/lib/utils';

/**
 * 고른 대여소 요약 — Variant `STATION_SELECTED`.
 *
 * 마커를 눌렀을 때 "이 대여소가 왜 이 색인가"에 답하는 자리입니다. 상태 색만으로는
 * 부족한지 얼마나 부족한지 알 수 없습니다.
 *
 * 여기 숫자는 전부 이미 있는 대여소 데이터에서 나옵니다. 계약에 없는 값(날씨·수요 예측·
 * 재배치 추천)은 지어내지 않습니다.
 */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between py-[7px]">
            <span className="text-[12px] font-medium text-brand-body">{label}</span>
            <span className="text-[12.5px] font-bold text-brand-ink">{children}</span>
        </div>
    );
}

export function SelectedStationPanel({
    station,
    onClear,
}: {
    station: Station;
    onClear: () => void;
}) {
    const status = getStationStatus(station);
    const meta = STATION_STATUS_META[status];
    const short = deficit(station);

    return (
        <section
            aria-label={`${station.name} 요약`}
            className="rounded-[10px] border border-brand-line-soft bg-white p-[18px]"
        >
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h3 className="text-[15px] font-extrabold text-brand-ink">{station.name}</h3>
                    <span
                        className={cn(
                            'mt-[6px] inline-flex items-center gap-[6px] text-[12px] font-bold',
                            meta.text,
                        )}
                    >
                        <span className={cn('size-[8px] rounded-full', meta.bg)} aria-hidden />
                        {meta.label}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onClear}
                    aria-label="선택 해제"
                    className="rounded p-1 text-brand-muted transition-colors hover:bg-brand-surface hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                >
                    <X className="size-4" aria-hidden />
                </button>
            </div>

            <div className="mt-[10px] divide-y divide-brand-line-soft border-t border-brand-line-soft">
                <Row label="사용 가능 / 전체">
                    <span className="tabular-nums">
                        {station.available} / {station.capacity}
                    </span>
                </Row>
                <Row label="채움 비율">
                    <span className="tabular-nums">{formatStockRatio(station)}</span>
                </Row>
                <Row label="장치">
                    <DeviceBadge status={station.deviceStatus} />
                </Row>
                {station.adminReview > 0 && (
                    <Row label="관리자 확인">
                        <span className="tabular-nums">{station.adminReview}</span>
                    </Row>
                )}
                {station.damaged > 0 && (
                    <Row label="파손">
                        <span className="tabular-nums">{station.damaged}</span>
                    </Row>
                )}
                {/*
                 * 상태 색은 "부족하다"만 알려주고 얼마나 부족한지는 말해 주지 않습니다.
                 * 보충하러 갈 사람에게 필요한 건 개수입니다.
                 */}
                {short > 0 && (
                    <Row label="적정까지 부족">
                        <span className="tabular-nums text-status-shortage">{short}개</span>
                    </Row>
                )}
            </div>

            <Link
                to={`/stations/${station.stationId}`}
                className="mt-[14px] flex h-[38px] items-center justify-center gap-[6px] rounded-[7px] bg-brand-blue text-[12.5px] font-bold text-white transition-colors hover:bg-brand-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
            >
                대여소 상세 보기
                <ArrowRight className="size-[15px]" aria-hidden />
            </Link>
        </section>
    );
}
