import { Link, useNavigate } from 'react-router-dom';

import { DetailLink } from '@/features/stations/components/DetailLink';
import { DeviceBadge } from '@/features/stations/components/DeviceBadge';
import { isDeviceOnline, type Station } from '@/features/stations/types';
import { DataTable, TBody, Td, TableCard, Th, THead, Tr } from '@/shared/components/DataTable';

export function StationTable({ stations }: { stations: Station[] }) {
    const navigate = useNavigate();

    return (
        <TableCard>
            <DataTable>
                {/* 열 너비는 시안(1280px)의 헤더 x 좌표에서 역산한 값입니다. */}
                <THead>
                    <Th className="w-[14%]">대여소ID</Th>
                    {/* 온라인 칸은 '장치 연결 끊김'이 들어가도록 시안(9.12%)보다 넓혔습니다. */}
                    <Th className="w-[23.5%]">위치(건물)</Th>
                    <Th align="center" className="w-[11.6%]">
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
                        <Tr
                            key={station.stationId}
                            accent={isDeviceOnline(station) ? undefined : 'red'}
                            // 라우트에는 UUID 가 들어갑니다. 표시 코드('ST-003')는 화면 글자일 뿐입니다.
                            onClick={() => navigate(`/stations/${station.stationId}`)}
                        >
                            <Td className="font-bold text-brand-ink">{station.stationCode}</Td>
                            <Td>
                                <Link
                                    to={`/stations/${station.stationId}`}
                                    className="font-bold text-tone-blue-fg transition-opacity hover:opacity-70"
                                >
                                    {station.name}
                                </Link>
                            </Td>
                            <Td align="center">
                                <DeviceBadge status={station.deviceStatus} />
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
                                <DetailLink to={`/stations/${station.stationId}`} />
                            </Td>
                        </Tr>
                    ))}
                </TBody>
            </DataTable>
        </TableCard>
    );
}
