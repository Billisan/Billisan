import { useNavigate } from 'react-router-dom';

import { DetailLink } from '@/features/stations/components/DetailLink';
import { SlotLockIcon } from '@/features/stations/components/SlotLockIcon';
import {
    deriveSlotDisplayStatus,
    formatSlotLabel,
    formatUpdatedAt,
    SLOT_DISPLAY_TONE,
    slotStatusHint,
    slotStatusText,
    type SlotSummary,
} from '@/features/stations/types';
import { Badge } from '@/shared/components/Badge';
import { DataTable, TBody, Td, TableCard, Th, THead, Tr } from '@/shared/components/DataTable';

interface SlotTableProps {
    /**
     * **`station` 을 더 이상 받지 않습니다.** 예전에는 슬롯마다 「온라인」 배지를 그리려고
     * 대여소를 통째로 넘겼습니다. 그 배지는 `STATION.device_status` 에서 파생하는데,
     * 그 값을 내려 주는 관리자 API 가 없어 늘 「확인 불가」였습니다. 열을 없애면서
     * 이 표가 대여소를 알아야 할 이유도 사라졌습니다 — 표시에 필요한 건 슬롯뿐입니다.
     *
     * **검수 열은 없습니다.** `ADMIN-SLOT-001` 응답에 검수 요약이 없어서 목록에서는
     * 판단할 수 없습니다. 검수 여부는 슬롯 상세와 검수 목록에서 봅니다.
     */
    slots: SlotSummary[];
}

export function SlotTable({ slots }: SlotTableProps) {
    const navigate = useNavigate();

    return (
        <TableCard>
            <DataTable>
                {/*
                 * 열 너비 — **합이 정확히 100% 여야 합니다.**
                 *
                 * `DataTable` 이 `table-fixed` 라 지정한 폭이 그대로 열 너비가 되는데,
                 * 예전 값은 `20 + 18 + 8.16 + 9 + 26.9 + 11.07 = 93.13%` 였습니다. 남는
                 * 6.87% 를 브라우저가 알아서 나눠 주면서 「최근 갱신」과 「상세」 사이가
                 * 휑하게 벌어졌습니다. 시안에서 폭을 하나씩 재다 생긴 소수점들이라
                 * 합을 맞춘 적이 없었고, 「온라인」 열을 빼면서 더 도드라졌습니다.
                 *
                 * 배분 규칙 둘:
                 *   1. 앞 두 열(`슬롯`·`슬롯 상태`)은 넉넉히 — 왼쪽에서 읽기 시작하는
                 *      값이라 붙어 있으면 눈이 갈라지지 않습니다.
                 *   2. 뒤 세 열(`잠금 여부`·`최근 갱신`·`상세`)은 **똑같이 14%씩**.
                 *      담는 게 아이콘 하나 · `08-01 09:19` · 링크뿐이라 넓힐 이유가 없고,
                 *      폭이 제각각이면 오른쪽 끝의 간격이 들쭉날쭉해 보입니다.
                 */}
                <THead>
                    <Th className="w-[34%]">슬롯</Th>
                    <Th align="center" className="w-[24%]">
                        슬롯 상태
                    </Th>
                    <Th align="center" className="w-[14%]">
                        잠금 여부
                    </Th>
                    <Th align="center" className="w-[14%]">
                        최근 갱신
                    </Th>
                    <Th className="w-[14%]">
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
                                    {formatSlotLabel(slot.slotNumber)}
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
