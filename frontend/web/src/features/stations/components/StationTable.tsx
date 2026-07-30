import { useNavigate } from 'react-router-dom';

import { DetailLink } from '@/features/stations/components/DetailLink';
import { DeviceBadge } from '@/features/stations/components/DeviceBadge';
import { isDeviceOnline, type Station } from '@/features/stations/types';
import { DataTable, TBody, Td, TableCard, Th, THead, Tr } from '@/shared/components/DataTable';
import { RefId } from '@/shared/components/RefId';

export function StationTable({ stations }: { stations: Station[] }) {
    const navigate = useNavigate();

    return (
        <TableCard>
            <DataTable>
                {/* 열 너비는 시안(1280px)의 헤더 x 좌표에서 역산한 값입니다. */}
                <THead>
                    <Th className="w-[14%]">대여소ID</Th>
                    {/* 온라인 배지가 ON/OFF/ERR 로 짧아져서 시안 폭(9.12%)으로 되돌리고,
                        남은 자리는 이름이 긴 대여소가 있는 위치 칸에 넘겼습니다. */}
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
                        <Tr
                            key={station.stationId}
                            accent={isDeviceOnline(station) ? undefined : 'red'}
                            // 라우트에는 UUID 가 들어갑니다. 표시 코드('ST-003')는 화면 글자일 뿐입니다.
                            onClick={() => navigate(`/stations/${station.stationId}`)}
                        >
                            {/*
                             * 예전에는 `stationCode`('ST-003')를 깔았는데 ERD v3.0 이 그
                             * 컬럼을 P0 필수에서 뺐습니다. 신원은 `station_id` 뿐이라
                             * 다른 화면과 같은 축약 표기(앞 8자 + 복사)로 보여 줍니다.
                             */}
                            <Td>
                                <RefId id={station.stationId} label="대여소 ID" />
                            </Td>
                            {/*
                             * 링크를 걷어냈습니다. 행 전체가 이미 눌리고 맨 오른쪽에 '상세'
                             * 링크도 있어서, 이름까지 파랗게 두면 누를 곳이 셋으로 보입니다.
                             */}
                            <Td className="font-bold text-brand-ink">{station.name}</Td>
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
