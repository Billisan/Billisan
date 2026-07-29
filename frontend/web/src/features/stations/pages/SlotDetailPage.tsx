import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { formatScore } from '@/features/inspections/mocks/aiVerdict';
import { DeviceBadge } from '@/features/stations/components/DeviceBadge';
import { SlotLockIcon } from '@/features/stations/components/SlotLockIcon';
import { SlotStatusDialog } from '@/features/stations/components/SlotStatusDialog';
import {
    useChangeSlotStatus,
    useSlotDetail,
    useStation,
} from '@/features/stations/hooks/useStations';
import { type SlotHistoryEntry } from '@/features/stations/mocks/slotDetail';
import { historyOf, outcomeOf } from '@/features/stations/mocks/slotOverrides';
import {
    AI_RESULT_TONE,
    aiResultText,
    DECISION_TONE,
    decisionText,
    deriveSlotDisplayStatus,
    formatSlotLabel,
    formatUpdatedAt,
    pendingInspectionId,
    SLOT_DISPLAY_TONE,
    slotStatusText,
} from '@/features/stations/types';
import { Badge } from '@/shared/components/Badge';
import { DataTable, TBody, Td, TableCard, Th, THead, Tr } from '@/shared/components/DataTable';
import { PageBar } from '@/shared/components/PageBar';

export function SlotDetailPage() {
    const { stationId, slotId } = useParams();
    const [dialogOpen, setDialogOpen] = useState(false);

    // 라우트 파라미터는 둘 다 UUID 입니다.
    const { data: station } = useStation(stationId);
    // ADMIN-SLOT-DETAIL-001
    const { data: slot } = useSlotDetail(slotId);
    // ADMIN-SLOT-STATUS-001 — 성공하면 훅이 캐시를 무효화해 이 조회가 다시 돕니다.
    const changeStatus = useChangeSlotStatus();

    if (!station || !slot) {
        return (
            <div>
                <PageBar
                    breadcrumb={[
                        { label: '대여소 관리', to: '/stations' },
                        ...(station
                            ? [
                                  {
                                      label: `${station.stationCode} ${station.name}`,
                                      to: `/stations/${station.stationId}`,
                                  },
                              ]
                            : []),
                    ]}
                />
                <div className="flex h-[200px] items-center justify-center rounded-lg bg-white text-[13px] font-medium text-brand-muted">
                    존재하지 않는 슬롯입니다. ({stationId} / {slotId})
                </div>
            </div>
        );
    }

    // 'SL-03-01' 은 station_code + slot_number 로 만드는 표시 라벨입니다. DB 컬럼이 아닙니다.
    const slotLabel = formatSlotLabel(station.stationCode, slot.slotNumber);
    const display = deriveSlotDisplayStatus(slot);
    const outcome = outcomeOf(slot);
    const history = historyOf(slot);
    const pendingId = pendingInspectionId(slot);

    return (
        <div>
            <PageBar
                breadcrumb={[
                    { label: '대여소 관리', to: '/stations' },
                    {
                        label: `${station.stationCode} ${station.name}`,
                        to: `/stations/${station.stationId}`,
                    },
                    { label: slotLabel },
                ]}
                meta={`최근 갱신 ${slot.updatedAt.slice(0, 10)} ${slot.updatedAt.slice(11, 16)}`}
            />

            {/* 요약 줄 */}
            <div className="mb-[18px] flex h-[58px] items-center rounded-lg bg-white pl-5 pr-4">
                <Badge tone={SLOT_DISPLAY_TONE[display]}>{slotStatusText(display)}</Badge>
                <h2 className="ml-[17px] text-[16px] font-bold text-brand-ink">
                    {slotLabel} · {station.name}({station.stationCode})
                </h2>

                <div className="ml-auto flex items-center gap-2">
                    {/*
                     * 미처리 검수가 걸린 슬롯은 상태 변경으로 확정하면 안 됩니다.
                     * ADMIN-SLOT-STATUS-001 은 슬롯만 바꾸고 파손 정산을 만들지 않아서,
                     * 우회하면 슬롯은 파손인데 청구가 없고 검수는 PENDING 으로 남습니다.
                     * 확정 경로는 ADMIN-INSPECTION-003 하나입니다 (화면흐름 §10.2 · §18).
                     */}
                    {pendingId && (
                        <Link
                            to={`/inspections/${pendingId}`}
                            className="inline-flex h-[34px] w-[77px] items-center justify-center rounded-[7px] bg-tone-amber-fg text-[13px] font-bold text-white transition-opacity hover:opacity-85"
                        >
                            검수하기
                        </Link>
                    )}
                    <button
                        type="button"
                        onClick={() => setDialogOpen(true)}
                        disabled={pendingId !== null}
                        title={
                            pendingId
                                ? '검수 대기 슬롯입니다. 검수에서 판정해야 파손 정산까지 함께 처리됩니다.'
                                : undefined
                        }
                        className="h-[34px] w-[77px] rounded-[7px] bg-brand-blue text-[13px] font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:bg-brand-border-soft disabled:text-brand-muted"
                    >
                        상태 변경
                    </button>
                </div>
            </div>

            {/* 2단 카드 */}
            <div className="mb-[46px] grid grid-cols-2 gap-[18px]">
                <InfoCard title="슬롯 상태">
                    <InfoRow label="우산 상태">
                        <Badge tone={SLOT_DISPLAY_TONE[display]}>{slotStatusText(display)}</Badge>
                    </InfoRow>
                    <InfoRow label="잠금 여부">
                        <SlotLockIcon locked={slot.lockStatus === 'LOCKED'} />
                    </InfoRow>
                    <InfoRow label="온라인">
                        <DeviceBadge status={station.deviceStatus} />
                    </InfoRow>
                    <InfoRow label="최근 갱신">
                        <span className="text-[13px] font-semibold tabular-nums text-brand-ink">
                            {slot.updatedAt.slice(0, 10)} {slot.updatedAt.slice(11, 16)}
                        </span>
                    </InfoRow>
                </InfoCard>

                <InfoCard title="최근 처리 결과">
                    {outcome ? (
                        <>
                            <InfoRow label="마지막 반납">
                                <LinkText>{outcome.lastRentalId}</LinkText>
                            </InfoRow>
                            {/* AI·관리자·슬롯은 값 집합이 셋 다 다릅니다. 라벨로도 구분해 둡니다. */}
                            <InfoRow label="AI 판정 (참고) / 신뢰도">
                                <span className="flex items-center gap-[7px]">
                                    {/* AI 값 집합은 슬롯 상태와 달라 톤 매핑도 따로 씁니다. */}
                                    <Badge tone={AI_RESULT_TONE[outcome.aiVerdict]}>
                                        {aiResultText(outcome.aiVerdict)}
                                    </Badge>
                                    <span className="text-brand-muted">/</span>
                                    {/* FAILED 는 점수가 없습니다. 0.00 으로 채우지 않습니다. */}
                                    <span className="text-[13px] font-semibold tabular-nums text-brand-ink">
                                        {formatScore(outcome.aiConfidence)}
                                    </span>
                                </span>
                            </InfoRow>
                            <InfoRow label="관리자 최종 판정 (확정)">
                                {/* 미처리(PENDING)면 아직 판정이 없습니다. AI 결과로 대신 채우지 않습니다. */}
                                {outcome.adminVerdict ? (
                                    <Badge tone={DECISION_TONE[outcome.adminVerdict]}>
                                        {decisionText(outcome.adminVerdict)}
                                    </Badge>
                                ) : (
                                    <Badge tone="amber">판정 대기</Badge>
                                )}
                            </InfoRow>
                            <InfoRow label="판정 사유">
                                <span className="text-[13px] font-semibold text-brand-ink">
                                    {outcome.reason ?? (
                                        <span className="font-medium text-brand-muted">—</span>
                                    )}
                                </span>
                            </InfoRow>
                            <InfoRow label="연결 반납 시도">
                                <LinkText>{outcome.returnAttemptId}</LinkText>
                            </InfoRow>
                        </>
                    ) : (
                        <p className="pt-1 text-[13px] font-medium text-brand-muted">
                            이 슬롯에는 아직 검수 결과가 없습니다.
                        </p>
                    )}
                </InfoCard>
            </div>

            <SlotHistoryTable entries={history} />

            <SlotStatusDialog
                open={dialogOpen}
                slot={slot}
                subtitle={`${slotLabel} · ${station.name}(${station.stationCode})`}
                onClose={() => setDialogOpen(false)}
                // TODO: ADMIN-SLOT-STATUS-001 `PATCH /api/v1/admin/slots/{slotId}/status` 연결.
                //       지금은 목업 스토어에 결과만 얹습니다.
                onSubmit={(change) => {
                    changeStatus.mutate({ slot, change });
                    setDialogOpen(false);
                }}
            />
        </div>
    );
}

/* ------------------------------------------------------------------ 하위 조각 */

/** 2단 카드 한 장. 시안 기준 제목 아래 15px, 행 간격 8px(행 높이 22px → 30px 주기)입니다. */
function InfoCard({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="rounded-lg bg-white p-5">
            <h3 className="mb-[15px] text-[15px] font-extrabold leading-none text-brand-ink">
                {title}
            </h3>
            <div className="space-y-2">{children}</div>
        </section>
    );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex h-[22px] items-center justify-between gap-4">
            <span className="text-[12.5px] font-medium text-brand-body">{label}</span>
            {children}
        </div>
    );
}

/** 다른 도메인(대여·반납 시도)으로 이어질 값. 라우트가 생기면 Link 로 바꾸세요. */
function LinkText({ children }: { children: ReactNode }) {
    return (
        <span className="text-[13px] font-bold tabular-nums text-brand-blue-ink">{children}</span>
    );
}

function SlotHistoryTable({ entries }: { entries: SlotHistoryEntry[] }) {
    return (
        <TableCard>
            <DataTable>
                {/* 열 너비는 시안(1280px)의 열 왼쪽 좌표에서 역산한 값입니다. */}
                <THead>
                    <Th className="w-[15.06%]">시각</Th>
                    <Th className="w-[12.97%]">구분</Th>
                    <Th className="w-[13.96%]">연결ID</Th>
                    <Th className="w-[40%]">상태 변화</Th>
                    <Th className="w-[15.07%]">사유·비고</Th>
                </THead>

                <TBody>
                    {entries.map((entry) => (
                        <Tr key={`${entry.at}-${entry.kind}`} className="h-[56px]">
                            <Td className="tabular-nums">{formatUpdatedAt(entry.at)}</Td>
                            <Td className="font-bold text-brand-ink">{entry.kind}</Td>
                            <Td>
                                {entry.linkId ? (
                                    <LinkText>{entry.linkId}</LinkText>
                                ) : (
                                    <span className="text-brand-muted" aria-label="연결 없음">
                                        —
                                    </span>
                                )}
                            </Td>
                            <Td>
                                <span className="flex items-center gap-[12px]">
                                    <Badge
                                        tone={SLOT_DISPLAY_TONE[entry.from]}
                                        className="whitespace-nowrap"
                                    >
                                        {slotStatusText(entry.from)}
                                    </Badge>
                                    <ArrowRight />
                                    <Badge
                                        tone={SLOT_DISPLAY_TONE[entry.to]}
                                        className="whitespace-nowrap"
                                    >
                                        {slotStatusText(entry.to)}
                                    </Badge>
                                </span>
                            </Td>
                            <Td>
                                <span className="block leading-[1.45] text-brand-ink">
                                    {entry.note}
                                </span>
                                {entry.noteSub && (
                                    <span className="block text-[11.5px] font-medium leading-[1.45] text-brand-muted">
                                        {entry.noteSub}
                                    </span>
                                )}
                            </Td>
                        </Tr>
                    ))}
                </TBody>
            </DataTable>
        </TableCard>
    );
}

/** 상태 변화 화살표. lucide 아이콘은 획이 얇아서 시안 벡터를 그대로 씁니다. */
function ArrowRight() {
    return (
        <svg viewBox="0 0 8.77 8.59" width="8.77" height="8.59" className="shrink-0" aria-hidden>
            <path
                d="M4.474 8.591L3.486 7.611L6.081 5.016H0V3.576H6.081L3.486 0.985L4.474 0L8.77 4.296L4.474 8.591Z"
                fill="#9AA9B6"
            />
        </svg>
    );
}
