import { useNavigate } from 'react-router-dom';

import { DetailLink } from '@/features/stations/components/DetailLink';
import { DeviceBadge } from '@/features/stations/components/DeviceBadge';
import { SlotLockIcon } from '@/features/stations/components/SlotLockIcon';
import {
    deriveSlotDisplayStatus,
    formatSlotLabel,
    formatUpdatedAt,
    SLOT_DISPLAY_TONE,
    slotStatusHint,
    slotStatusText,
    type SlotSummary,
    type Station,
} from '@/features/stations/types';
import { Badge } from '@/shared/components/Badge';
import { DataTable, TBody, Td, TableCard, Th, THead, Tr } from '@/shared/components/DataTable';

interface SlotTableProps {
    /**
     * 슬롯의 표시 라벨('SL-03-01')은 `station_code` + `slot_number` 로 만듭니다.
     * 슬롯별 온라인도 슬롯의 영속 상태가 아니라 대여소 장치 상태에서 파생합니다.
     * 그래서 slotId 만이 아니라 대여소가 통째로 필요합니다.
     *
     * **검수 열은 없습니다.** `ADMIN-SLOT-001` 응답에 검수 요약이 없어서 목록에서는
     * 판단할 수 없습니다. 검수 여부는 슬롯 상세와 검수 목록에서 봅니다.
     */
    station: Station;
    slots: SlotSummary[];
}

export function SlotTable({ station, slots }: SlotTableProps) {
    const navigate = useNavigate();

    return (
        <TableCard>
            <DataTable>
                {/*
                 * 열 너비는 시안(1280px) 기준입니다.
                 * 상태 배지가 `이용 가능(AVAILABLE)` 에서 `이용 가능` 으로 짧아졌고 온라인도
                 * `ON`/`OFF` 라, 넓혀 뒀던 두 칸을 줄이고 남은 폭을 slotId·최근 갱신에 넘깁니다.
                 */}
                <THead>
                    <Th className="w-[20%]">slotId</Th>
                    <Th align="center" className="w-[18%]">
                        우산 상태
                    </Th>
                    <Th align="center" className="w-[8.16%]">
                        잠금 여부
                    </Th>
                    <Th align="center" className="w-[9%]">
                        온라인
                    </Th>
                    <Th align="center" className="w-[26.9%]">
                        최근 갱신
                    </Th>
                    <Th className="w-[11.07%]">
                        <span className="sr-only">슬롯 작업</span>
                    </Th>
                </THead>

                <TBody>
                    {slots.map((slot) => {
                        const display = deriveSlotDisplayStatus(slot);
                        const slotPath = `/slots/${slot.slotId}`;
                        /*
                         * 막대는 **관리자가 아직 할 일이 남은 슬롯에만** 답니다.
                         *
                         * `ADMIN_REVIEW` 는 "실물 판정 전 격리"라 사람이 판정해야 다음이
                         * 진행됩니다 (ERD SLOT 표시 기준). 검수에서 `KEEP_ADMIN_REVIEW` 로
                         * 보류해도 슬롯은 `ADMIN_REVIEW` 로 남고 검수는 다시 미처리가 되므로
                         * (화면흐름 §10.2), 이 상태는 곧 '검수 미처리'와 같습니다.
                         *
                         * `DAMAGED` 는 **이미 관리자가 판정을 끝낸** 결과입니다. 배지로 이미
                         * 빨갛게 보이고 할 일은 없어서 막대를 달지 않습니다. 처리된 것까지
                         * 강조하면 정작 손대야 할 행이 묻힙니다.
                         */
                        const accent = display === 'ADMIN_REVIEW' ? 'amber' : undefined;

                        return (
                            // 행을 누르면 어느 행이든 슬롯 상세로 갑니다.
                            <Tr
                                key={slot.slotId}
                                accent={accent}
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
                                        title={slotStatusHint(display)}
                                    >
                                        {slotStatusText(display)}
                                    </Badge>
                                </Td>
                                <Td align="center">
                                    {/* svg 는 기본이 inline 이라 베이스라인에 걸립니다. flex 로 감싸 가운데 정렬 */}
                                    <span className="flex justify-center">
                                        <SlotLockIcon status={slot.lockStatus} />
                                    </span>
                                </Td>
                                <Td align="center">
                                    <DeviceBadge status={station.deviceStatus} />
                                </Td>
                                <Td align="center" className="tabular-nums">
                                    {formatUpdatedAt(slot.updatedAt)}
                                </Td>
                                <Td align="center">
                                    <DetailLink to={slotPath} />
                                </Td>
                            </Tr>
                        );
                    })}
                </TBody>
            </DataTable>
        </TableCard>
    );
}
