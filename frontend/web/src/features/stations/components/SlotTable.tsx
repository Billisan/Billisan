import { useNavigate } from 'react-router-dom';

import { DetailLink } from '@/features/stations/components/DetailLink';
import { DeviceBadge } from '@/features/stations/components/DeviceBadge';
import { InspectLink } from '@/features/stations/components/InspectLink';
import { SlotLockIcon } from '@/features/stations/components/SlotLockIcon';
import {
    deriveSlotDisplayStatus,
    formatSlotLabel,
    formatUpdatedAt,
    pendingInspectionId,
    SLOT_DISPLAY_TONE,
    slotStatusText,
    type Slot,
    type Station,
} from '@/features/stations/types';
import { Badge } from '@/shared/components/Badge';
import { DataTable, TBody, Td, TableCard, Th, THead, Tr } from '@/shared/components/DataTable';
import { REVIEW_STATUS_LABEL, withCode } from '@/shared/constants/statusLabels';

interface SlotTableProps {
    /**
     * 슬롯의 표시 라벨('SL-03-01')은 `station_code` + `slot_number` 로 만듭니다.
     * 슬롯별 온라인도 슬롯의 영속 상태가 아니라 대여소 장치 상태에서 파생합니다 (GAP-WEB-013).
     * 그래서 slotId 만이 아니라 대여소가 통째로 필요합니다.
     */
    station: Station;
    slots: Slot[];
}

export function SlotTable({ station, slots }: SlotTableProps) {
    const navigate = useNavigate();

    return (
        <TableCard>
            <DataTable>
                {/* 열 너비는 시안(1280px) 기준이되, 한글(CODE) 배지가 들어가도록 상태 칸을 넓혔습니다. */}
                <THead>
                    <Th className="w-[12.12%]">slotId</Th>
                    <Th align="center" className="w-[22.5%]">
                        우산 상태
                    </Th>
                    <Th align="center" className="w-[8.16%]">
                        잠금 여부
                    </Th>
                    <Th align="center" className="w-[14.85%]">
                        검수
                    </Th>
                    <Th align="center" className="w-[11%]">
                        온라인
                    </Th>
                    <Th align="center" className="w-[17.4%]">
                        최근 갱신
                    </Th>
                    <Th className="w-[11.07%]">
                        <span className="sr-only">슬롯 작업</span>
                    </Th>
                </THead>

                <TBody>
                    {slots.map((slot) => {
                        const display = deriveSlotDisplayStatus(slot);
                        const inspectionId = pendingInspectionId(slot);
                        const slotPath = `/stations/${station.stationId}/slots/${slot.slotId}`;

                        return (
                            // 행을 누르면 어느 행이든 슬롯 상세로 갑니다.
                            // '검수' 버튼만 검수 상세로 따로 빠집니다.
                            <Tr
                                key={slot.slotId}
                                className="h-[47.75px]"
                                onClick={() => navigate(slotPath)}
                            >
                                <Td className="font-bold text-brand-ink">
                                    {formatSlotLabel(station.stationCode, slot.slotNumber)}
                                </Td>
                                <Td align="center">
                                    <Badge
                                        tone={SLOT_DISPLAY_TONE[display]}
                                        className="whitespace-nowrap"
                                    >
                                        {slotStatusText(display)}
                                    </Badge>
                                </Td>
                                <Td align="center">
                                    {/* svg 는 기본이 inline 이라 베이스라인에 걸립니다. flex 로 감싸 가운데 정렬 */}
                                    <span className="flex justify-center">
                                        <SlotLockIcon locked={slot.lockStatus === 'LOCKED'} />
                                    </span>
                                </Td>
                                <Td align="center">
                                    {slot.inspection ? (
                                        <Badge
                                            tone={
                                                slot.inspection.reviewStatus === 'PENDING'
                                                    ? 'amber'
                                                    : 'green'
                                            }
                                            className="whitespace-nowrap"
                                        >
                                            {withCode(
                                                REVIEW_STATUS_LABEL,
                                                slot.inspection.reviewStatus,
                                            )}
                                        </Badge>
                                    ) : (
                                        <span className="text-brand-muted" aria-label="검수 없음">
                                            —
                                        </span>
                                    )}
                                </Td>
                                <Td align="center">
                                    <DeviceBadge status={station.deviceStatus} />
                                </Td>
                                <Td align="center" className="tabular-nums">
                                    {formatUpdatedAt(slot.updatedAt)}
                                </Td>
                                <Td align="center">
                                    {inspectionId ? (
                                        <InspectLink to={`/inspections/${inspectionId}`} />
                                    ) : (
                                        <DetailLink to={slotPath} />
                                    )}
                                </Td>
                            </Tr>
                        );
                    })}
                </TBody>
            </DataTable>
        </TableCard>
    );
}
