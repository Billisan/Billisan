import { DetailLink } from '@/features/stations/components/DetailLink';
import { InspectLink } from '@/features/stations/components/InspectLink';
import { SlotLockIcon } from '@/features/stations/components/SlotLockIcon';
import { needsInspection, SLOT_STATUS_META, type Slot } from '@/features/stations/types';
import { Badge } from '@/shared/components/Badge';
import { DataTable, TBody, Td, TableCard, Th, THead, Tr } from '@/shared/components/DataTable';

export function SlotTable({ stationId, slots }: { stationId: string; slots: Slot[] }) {
    return (
        <TableCard>
            <DataTable>
                {/* 열 너비는 시안(1280px)의 헤더 x 좌표에서 역산한 값입니다. */}
                <THead>
                    <Th className="w-[13.1%]">slotId</Th>
                    <Th align="center" className="w-[22.89%]">
                        우산 상태
                    </Th>
                    <Th align="center" className="w-[13.1%]">
                        잠금 여부
                    </Th>
                    <Th align="center" className="w-[16.9%]">
                        온라인
                    </Th>
                    <Th className="w-[20.02%]">최근 갱신</Th>
                    <Th className="w-[11.07%]">
                        <span className="sr-only">슬롯 작업</span>
                    </Th>
                </THead>

                <TBody>
                    {slots.map((slot) => {
                        const meta = SLOT_STATUS_META[slot.status];

                        return (
                            <Tr key={slot.id} accent={meta.accent}>
                                <Td className="font-bold text-brand-ink">{slot.id}</Td>
                                <Td align="center">
                                    <Badge tone={meta.tone}>{slot.status}</Badge>
                                </Td>
                                <Td align="center">
                                    {/* svg 는 기본이 inline 이라 베이스라인에 걸립니다. flex 로 감싸 가운데 정렬 */}
                                    <span className="flex justify-center">
                                        <SlotLockIcon locked={slot.locked} />
                                    </span>
                                </Td>
                                <Td align="center">
                                    <Badge tone={slot.online ? 'green' : 'red'}>
                                        {slot.online ? 'ON' : 'OFF'}
                                    </Badge>
                                </Td>
                                <Td className="tabular-nums">{slot.updatedAt}</Td>
                                <Td align="center">
                                    {needsInspection(slot.status) ? (
                                        <InspectLink to="/inspections" />
                                    ) : (
                                        <DetailLink
                                            to={`/stations/${stationId}/slots/${slot.id}`}
                                        />
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
