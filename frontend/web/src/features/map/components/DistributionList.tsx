import { DetailLink } from '@/features/stations/components/DetailLink';
import { DeviceBadge } from '@/features/stations/components/DeviceBadge';
import { formatStockRatio } from '@/features/map/lib/distribution';
import { getStationStatus, STATION_STATUS_META, type Station } from '@/features/stations/types';
import { DataTable, TBody, Td, TableCard, Th, THead, Tr } from '@/shared/components/DataTable';
import { cn } from '@/lib/utils';

/**
 * 분포도의 목록형 대체 UI — `ACT-WEB-MAP-003`, Variant `SDK_ERROR`.
 *
 * 화면흐름 §13: "지도 실패: SDK 오류 시 **동일 데이터의 목록형 대체 UI를 제공한다.**"
 *
 * '동일 데이터'가 핵심입니다. 지도가 안 뜬다고 정보가 줄면 대체가 아닙니다. 마커가 보여
 * 주던 것(상태·사용 가능·전체·채움 비율·장치)을 표로 그대로 옮깁니다.
 *
 * 지도가 멀쩡할 때도 직접 켤 수 있게 두었습니다. 8개소를 눈으로 훑는 것보다 표를 정렬해
 * 보는 편이 빠른 경우가 있고, 화면 낭독기를 쓰면 표가 유일하게 읽히는 형태입니다.
 */
export function DistributionList({
    stations,
    selectedId,
    onSelect,
}: {
    stations: readonly Station[];
    selectedId: string | null;
    onSelect: (stationId: string) => void;
}) {
    return (
        <TableCard>
            <DataTable>
                <THead>
                    <Th className="w-[26%]">대여소</Th>
                    <Th align="center" className="w-[12%]">
                        상태
                    </Th>
                    <Th align="center" className="w-[10%]">
                        온라인
                    </Th>
                    <Th align="center" className="w-[16%]">
                        사용 가능 / 전체
                    </Th>
                    <Th align="center" className="w-[12%]">
                        채움 비율
                    </Th>
                    <Th align="center" className="w-[14%]">
                        관리자 확인
                    </Th>
                    <Th className="w-[10%]">
                        <span className="sr-only">상세 보기</span>
                    </Th>
                </THead>

                <TBody>
                    {stations.map((station) => {
                        const status = getStationStatus(station);
                        const meta = STATION_STATUS_META[status];
                        const selected = station.stationId === selectedId;

                        return (
                            <Tr
                                key={station.stationId}
                                accent={status === 'OFFLINE' ? 'red' : undefined}
                                // 표에서 고르면 지도의 선택도 같이 움직입니다.
                                onClick={() => onSelect(station.stationId)}
                            >
                                <Td
                                    className={cn(
                                        'font-bold',
                                        selected ? 'text-brand-blue' : 'text-brand-ink',
                                    )}
                                >
                                    {station.name}
                                </Td>
                                <Td align="center">
                                    <span
                                        className={cn(
                                            'inline-flex items-center gap-[6px] text-[12px] font-bold',
                                            meta.text,
                                        )}
                                    >
                                        <span
                                            className={cn('size-[8px] rounded-full', meta.bg)}
                                            aria-hidden
                                        />
                                        {meta.label}
                                    </span>
                                </Td>
                                <Td align="center">
                                    <DeviceBadge status={station.deviceStatus} />
                                </Td>
                                <Td align="center" className="tabular-nums">
                                    <span className="font-bold text-brand-ink">
                                        {station.available}
                                    </span>
                                    <span className="text-brand-muted"> / {station.capacity}</span>
                                </Td>
                                <Td align="center" className="tabular-nums font-semibold">
                                    {formatStockRatio(station)}
                                </Td>
                                <Td align="center" className="tabular-nums">
                                    {station.adminReview}
                                </Td>
                                <Td align="center">
                                    <DetailLink to={`/stations/${station.stationId}`} />
                                </Td>
                            </Tr>
                        );
                    })}
                </TBody>
            </DataTable>
        </TableCard>
    );
}
