import { useNavigate } from 'react-router-dom';

import { DetailLink } from '@/features/stations/components/DetailLink';
import { DeviceBadge } from '@/features/stations/components/DeviceBadge';
import {
    getStationStatus,
    isDeviceOnline,
    STATION_STATUS_META,
    type Station,
} from '@/features/stations/types';
import { DataTable, TBody, Td, TableCard, Th, THead, Tr } from '@/shared/components/DataTable';
import { RefId } from '@/shared/components/RefId';
import { cn } from '@/lib/utils';

export function StationTable({ stations }: { stations: Station[] }) {
    const navigate = useNavigate();

    return (
        <TableCard>
            <DataTable>
                {/* 열 너비는 시안(1280px)의 헤더 x 좌표에서 역산한 값입니다. */}
                <THead>
                    {/*
                     * 식별자와 이름을 **각각 다른 열**로 둡니다.
                     *
                     * 한 칸에 이름 + 그 아래 작은 UUID 로 합쳐 봤는데, 행 높이가 두 줄로
                     * 늘어나면서 표가 길어지고 UUID 가 부속물처럼 흐려졌습니다. 로그에 찍힌
                     * 값을 눈으로 훑어 내려가며 대조하려면 **한 열에 세로로 가지런히**
                     * 놓이는 편이 낫습니다.
                     */}
                    <Th className="w-[13%]">대여소ID</Th>
                    {/* 온라인 배지가 ON/OFF/ERR 로 짧아져서 시안 폭(9.12%)으로 되돌리고,
                        남은 자리는 이름이 긴 대여소가 있는 위치 칸에 넘겼습니다. */}
                    <Th className="w-[23%]">위치(건물)</Th>
                    <Th align="center" className="w-[9%]">
                        온라인
                    </Th>
                    {/*
                     * `사용 가능 / 전체` 로 함께 보여 줍니다.
                     *
                     * 숫자 하나만 있으면 크기를 알 수 없습니다. `사용 가능 2` 가 슬롯 3개짜리
                     * 대여소에서는 넉넉한 것이고 5개짜리에서는 부족한 것인데, 목록에서는
                     * 구분이 안 됐습니다. 대시보드 재고 순위는 이미 `2 / 5` 로 쓰고 있어서
                     * 두 화면의 읽는 법도 통일됩니다.
                     *
                     * 분모는 `ADMIN-INVENTORY-001` 의 `totalSlotCount`(전체 SLOT 수)입니다.
                     * ERD 가 개별 우산을 식별하지 않으므로(DEC-ERD-011) '우산 총 개수' 라는
                     * 값은 존재하지 않고, 셀 수 있는 건 슬롯 수뿐입니다.
                     */}
                    <Th align="center" className="w-[15%]">
                        사용 가능 / 전체
                    </Th>
                    {/*
                     * 재고 상태. `사용 가능 / 전체` 바로 옆에 두어 그 숫자를 해석해 줍니다.
                     *
                     * `2 / 5` 와 `2 / 3` 중 어느 쪽이 급한지는 나눠 봐야 압니다. 8개소를
                     * 매번 암산하게 두는 대신 색과 말로 답을 붙입니다. 판정 기준은
                     * 대시보드·분포도와 같은 `getStationStatus`(채움 비율)입니다 — 세 화면이
                     * 다른 말을 하면 어느 것도 믿을 수 없게 됩니다.
                     */}
                    <Th align="center" className="w-[11%]">
                        재고
                    </Th>
                    <Th align="center" className="w-[7%]">
                        파손
                    </Th>
                    <Th align="center" className="w-[13%]">
                        관리자 확인
                    </Th>
                    <Th className="w-[9%]">
                        <span className="sr-only">상세 보기</span>
                    </Th>
                </THead>

                <TBody>
                    {stations.map((station) => {
                        const status = getStationStatus(station);
                        const statusMeta = STATION_STATUS_META[status];

                        return (
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
                                 *
                                 * 앞 8자만 보면 대여소끼리 비슷해 보이지만, 이 열의 용도는
                                 * "눈으로 읽기"가 아니라 **로그에 찍힌 값과 대조하고 복사하기**
                                 * 입니다. 이름은 옆 칸이 맡습니다.
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
                                    <span className="font-bold text-brand-ink">
                                        {station.available}
                                    </span>
                                    <span className="text-brand-muted"> / {station.capacity}</span>
                                </Td>
                                {/*
                                 * 장치가 끊긴 대여소는 「오프라인」입니다. 옆 칸의 OFF 와 겹쳐
                                 * 보이지만, 그 경우 재고 숫자를 믿을 수 없다는 뜻이라 여기에
                                 * 「적정」을 띄우면 안 됩니다.
                                 */}
                                <Td align="center">
                                    <span
                                        className={cn(
                                            'inline-flex items-center gap-[6px] text-[12px] font-bold',
                                            statusMeta.text,
                                        )}
                                    >
                                        <span
                                            className={cn('size-[8px] rounded-full', statusMeta.bg)}
                                            aria-hidden
                                        />
                                        {statusMeta.label}
                                    </span>
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
                        );
                    })}
                </TBody>
            </DataTable>
        </TableCard>
    );
}
