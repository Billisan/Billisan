import { Link } from 'react-router-dom';

import { DetailLink } from '@/features/stations/components/DetailLink';
import type { Station } from '@/features/stations/types';
import { Badge } from '@/shared/components/Badge';
import { DataTable, TBody, Td, TableCard, Th, THead, Tr } from '@/shared/components/DataTable';

export function StationTable({ stations }: { stations: Station[] }) {
    return (
        <TableCard>
            <DataTable>
                {/* 열 너비는 시안(1280px)의 헤더 x 좌표에서 역산한 값입니다. */}
                <THead>
                    <Th className="w-[14%]">대여소ID</Th>
                    <Th className="w-[25.98%]">위치(건물)</Th>
                    <Th align="center" className="w-[9.12%]">
                        온라인
                    </Th>
                    <Th align="center" className="w-[14.87%]">
                        사용 가능
                    </Th>
                    <Th align="center" className="w-[7.11%]">
                        파손
                    </Th>
                    <Th align="center" className="w-[16.9%]">
                        관리자 확인
                    </Th>
                    <Th className="w-[9.08%]">
                        <span className="sr-only">상세 보기</span>
                    </Th>
                </THead>

                <TBody>
                    {stations.map((station) => (
                        <Tr key={station.id} accent={station.online ? undefined : 'red'}>
                            <Td className="font-bold text-brand-ink">{station.id}</Td>
                            <Td>
                                <Link
                                    to={`/stations/${station.id}`}
                                    className="font-bold text-tone-blue-fg transition-opacity hover:opacity-70"
                                >
                                    {station.name}
                                </Link>
                            </Td>
                            <Td align="center">
                                <Badge tone={station.online ? 'green' : 'red'}>
                                    {station.online ? 'ON' : 'OFF'}
                                </Badge>
                            </Td>
                            <Td align="center" className="tabular-nums">
                                {station.available}
                            </Td>
                            <Td align="center" className="tabular-nums">
                                {station.damaged}
                            </Td>
                            <Td align="center" className="tabular-nums">
                                {station.adminReview}
                            </Td>
                            <Td align="center">
                                <DetailLink to={`/stations/${station.id}`} />
                            </Td>
                        </Tr>
                    ))}
                </TBody>
            </DataTable>
        </TableCard>
    );
}
