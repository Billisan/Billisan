import { useNavigate } from 'react-router-dom';

import { DetailLink } from '@/features/stations/components/DetailLink';
import {
    getStationStatus,
    isDeviceOffline,
    STATION_STATUS_META,
    type Station,
} from '@/features/stations/types';
import { DataTable, TBody, Td, TableCard, Th, THead, Tr } from '@/shared/components/DataTable';
import { cn } from '@/lib/utils';

export function StationTable({ stations }: { stations: Station[] }) {
    const navigate = useNavigate();

    return (
        <TableCard>
            <DataTable>
                {/* 열 너비는 시안(1280px)의 헤더 x 좌표에서 역산한 값입니다. */}
                <THead>
                    {/*
                     * **대여소 ID 열은 뺐습니다.**
                     *
                     * 검수·반납·정산은 사람이 읽을 이름이 없어서 UUID 축약이 유일한 표기지만,
                     * 대여소는 `name` 이 NOT NULL 로 보장됩니다. 이름이 있는데 옆에 UUID 를
                     * 나란히 두면 열 하나를 쓰면서 관리자가 읽을 일은 거의 없습니다.
                     *
                     * 로그 대조용 전체 값은 **상세 화면에 그대로 남아 있고**, 목록 검색창은
                     * 여전히 UUID 앞자리로도 걸립니다 — 찾는 경로는 잃지 않았습니다.
                     */}
                    {/* ID·온라인 열이 빠진 만큼 이름 칸을 넓혔습니다. */}
                    <Th className="w-[40%]">위치(건물)</Th>
                    {/*
                     * **「온라인」 열을 뺐습니다.**
                     *
                     * `STATION.device_status` 는 DB 에 있지만 그걸 내려 주는 관리자 API 가
                     * 없습니다(스웨거 9개 경로 전수 확인). 그동안은 실 모드에서 `'ONLINE'` 을
                     * 박아 넣어 **전 대여소가 항상 「ON · 장치 연결됨」**으로 떴습니다.
                     * 함이 꺼져 있어도 서버는 DB 슬롯 행을 돌려주므로 화면만 거짓말합니다.
                     *
                     * 없는 정보를 그럴듯하게 채우느니 열을 비웁니다. 장치 상태가 궁금하면
                     * 대여소 상세에 「확인 불가」로 정직하게 표시돼 있습니다.
                     * TODO: 대여소 조회 API 가 `device_status` 를 주면 열을 되살리세요.
                     */}
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
                    <Th align="center" className="w-[16%]">
                        재고
                    </Th>
                    {/*
                     * **「파손 · 관리자 확인 · 센서 이상」 열을 뺐습니다.**
                     *
                     * 이 목록의 일은 **어디로 갈지 고르는 것**이고, 그 판단은 왼쪽
                     * 「사용 가능 / 전체 · 재고」가 이미 해 줍니다. 세 숫자는 대부분 0 이나 1 이라
                     * 열 셋을 쓰면서 전달하는 정보가 적었습니다.
                     *
                     * 어디서 보면 되는지:
                     *   관리자 확인 — **검수 목록**에 대여소 이름·슬롯 번호까지 다 있습니다.
                     *                 대시보드 「파손 검수 대기」를 눌러도 그리로 갑니다.
                     *   파손·센서 이상 — 대여소 상세(우산 재고)의 집계 카드 6종.
                     *
                     * 파손·센서 이상은 대여소를 가로질러 보는 화면이 아직 없다는 걸 알고
                     * 뺍니다. 급해서 목록에서 봐야 하는 일이 아니라 순찰 때 처리하는 일이고,
                     * 그때는 어차피 상세를 엽니다.
                     * TODO: 「파손이 쌓인 대여소」를 한눈에 보려는 요구가 생기면 이 표에 열을
                     *       늘리지 말고 **대여소를 가로지르는 목록 화면**을 새로 만드세요.
                     */}
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
                                /*
                                 * 끊긴 것이 **확인된** 대여소만 붉게 칠합니다.
                                 * `!isDeviceOnline()` 이면 장치 상태를 모르는 대여소까지
                                 * 전부 빨간 줄이 돼서, 실 API 모드에서 표 전체가 경고가 됩니다.
                                 */
                                accent={isDeviceOffline(station) ? 'red' : undefined}
                                // 라우트에는 UUID 가 들어갑니다. 표시 코드('ST-003')는 화면 글자일 뿐입니다.
                                onClick={() => navigate(`/stations/${station.stationId}`)}
                            >
                                {/*
                                 * 링크를 걷어냈습니다. 행 전체가 이미 눌리고 맨 오른쪽에 '상세'
                                 * 링크도 있어서, 이름까지 파랗게 두면 누를 곳이 셋으로 보입니다.
                                 */}
                                <Td className="font-bold text-brand-ink">{station.name}</Td>
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
