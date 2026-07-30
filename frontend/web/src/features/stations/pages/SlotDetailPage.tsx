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
import {
    buildSlotHistory,
    shortRef,
    type SlotHistoryEntry,
} from '@/features/stations/mocks/slotDetail';
import {
    AI_RESULT_TONE,
    aiResultText,
    DECISION_TONE,
    decisionHint,
    decisionText,
    deriveSlotDisplayStatus,
    formatSlotLabel,
    formatUpdatedAt,
    pendingInspectionId,
    SLOT_DISPLAY_TONE,
    slotStatusHint,
    slotStatusText,
} from '@/features/stations/types';
import { Badge } from '@/shared/components/Badge';
import { CopyButton } from '@/shared/components/CopyButton';
import { DataTable, TBody, Td, TableCard, Th, THead, Tr } from '@/shared/components/DataTable';
import { PageBar } from '@/shared/components/PageBar';
import { PageTitle } from '@/shared/components/PageTitle';
import { LOCK_STATUS_LABEL } from '@/shared/constants/statusLabels';

export function SlotDetailPage() {
    const { slotId } = useParams();
    const [dialogOpen, setDialogOpen] = useState(false);

    // ADMIN-SLOT-DETAIL-001 — 라우트 파라미터는 슬롯 UUID 하나뿐입니다.
    const { data: slot } = useSlotDetail(slotId);
    /*
     * 대여소는 **슬롯 응답의 `stationId`** 로 찾습니다. 주소에서 받지 않습니다.
     *
     * 예전에는 `/stations/:stationId/slots/:slotId` 라 대여소를 주소에서 가져왔는데,
     * 둘이 어긋나면(주소를 손대거나 링크를 잘못 복사하면) 슬롯은 그대로인데 대여소 이름·코드가
     * 다른 곳으로 표시됐습니다. `SL-01-01` 이 `SL-03-01` 로 보이는 식입니다.
     * 서버가 준 소속을 쓰면 그 어긋남 자체가 불가능합니다.
     */
    const { data: station } = useStation(slot?.stationId);
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
                                      label: station.name,
                                      to: `/stations/${station.stationId}`,
                                  },
                              ]
                            : []),
                    ]}
                />
                <div className="flex h-[200px] items-center justify-center rounded-lg bg-white text-[13px] font-medium text-brand-muted">
                    존재하지 않는 슬롯입니다. ({slotId})
                </div>
            </div>
        );
    }

    // 'SL-03-01' 은 station_code + slot_number 로 만드는 표시 라벨입니다. DB 컬럼이 아닙니다.
    const slotLabel = formatSlotLabel(slot.slotNumber);
    const display = deriveSlotDisplayStatus(slot);
    // 상세 응답의 latestInspection / latestReturnAttempt 를 그대로 씁니다 (12-R B-4).
    const inspection = slot.latestInspection;
    const history = buildSlotHistory(slot);
    const pendingId = pendingInspectionId(slot);

    return (
        <div>
            <PageBar
                breadcrumb={[
                    { label: '대여소 관리', to: '/stations' },
                    {
                        label: station.name,
                        to: `/stations/${station.stationId}`,
                    },
                    { label: slotLabel },
                ]}
                meta={`최근 갱신 ${slot.updatedAt.slice(0, 10)} ${slot.updatedAt.slice(11, 16)}`}
            />

            {/* 요약 줄 */}
            <div className="mb-[18px] flex h-[58px] items-center rounded-lg bg-white pl-5 pr-4">
                <Badge tone={SLOT_DISPLAY_TONE[display]} title={slotStatusHint(display)}>
                    {slotStatusText(display)}
                </Badge>
                <PageTitle
                    className="ml-[17px] !text-[16px] !font-bold"
                    documentTitle={`${slotLabel} 슬롯`}
                >
                    {`${slotLabel} · ${station.name}`}
                </PageTitle>

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
                {/*
                 * 우산 상태 줄은 없습니다. 바로 위 요약 줄의 배지와 같은 값(`display`)이라
                 * 한 화면에 두 번 그릴 이유가 없습니다.
                 */}
                <InfoCard title="슬롯 상태">
                    <InfoRow label="잠금 여부">
                        {/*
                         * 표와 달리 상세는 자리가 넉넉합니다. 아이콘만 두면 `잠금 확인 불가`와
                         * `잠금 오류`를 색으로만 구분해야 해서 글자를 같이 답니다.
                         */}
                        <span className="flex items-center gap-[7px]">
                            <SlotLockIcon status={slot.lockStatus} />
                            <span className="text-[13px] font-semibold text-brand-ink">
                                {LOCK_STATUS_LABEL[slot.lockStatus]}
                            </span>
                        </span>
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

                <InfoCard title="최근 검수">
                    {inspection ? (
                        <>
                            {/* AI·관리자·슬롯은 값 집합이 셋 다 다릅니다. 라벨로도 구분해 둡니다. */}
                            <InfoRow label="AI 판정 (참고) / 점수">
                                <span className="flex items-center gap-[7px]">
                                    <Badge tone={AI_RESULT_TONE[inspection.aiResult]}>
                                        {aiResultText(inspection.aiResult)}
                                    </Badge>
                                    <span className="text-brand-muted">/</span>
                                    {/* FAILED 는 점수가 없습니다. 0.00 으로 채우지 않습니다. */}
                                    <span className="text-[13px] font-semibold tabular-nums text-brand-ink">
                                        {formatScore(inspection.aiScore)}
                                    </span>
                                </span>
                            </InfoRow>
                            <InfoRow label="관리자 최종 판정 (확정)">
                                {/* 미처리(PENDING)면 아직 판정이 없습니다. AI 결과로 대신 채우지 않습니다. */}
                                {inspection.decision ? (
                                    <Badge
                                        tone={DECISION_TONE[inspection.decision]}
                                        title={decisionHint(inspection.decision)}
                                    >
                                        {decisionText(inspection.decision)}
                                    </Badge>
                                ) : (
                                    <Badge tone="amber">판정 대기</Badge>
                                )}
                            </InfoRow>
                            {/*
                             * 모델 버전·처리 시각은 여기 두지 않습니다.
                             * §7.6 슬롯 상세 표시 필드는 `AI 결과·신뢰도` 까지이고, 모델 버전은
                             * `WF-WEB-CHANGE-001` 이 검수 상세(`SCR-WEB-INSPECTION-DETAIL-001`)
                             * 의 항목으로 정했습니다 — "AI 결과, 신뢰도, 모델 버전, 추론 시각·지연".
                             * 아래 '검수 상세' 링크 한 번이면 거기서 봅니다.
                             */}
                            {/*
                             * `최근 returnAttemptId` 는 §7.6 표시 필드에 명시된 항목이라 남깁니다.
                             * 이 슬롯을 지금 상태로 만든 반납 건이고, 백엔드에 문의할 때 지목하는
                             * 값입니다. 반납 상세(P1)는 목업 식별자 체계가 달라 아직 링크하지 않고
                             * 마우스오버·복사로 전체 값을 꺼낼 수 있게 둡니다.
                             */}
                            <InfoRow label="연결 반납 시도">
                                <RefId id={slot.latestReturnAttempt?.returnAttemptId} />
                            </InfoRow>
                            <InfoRow label="판정 사유">
                                <Link
                                    to={`/inspections/${inspection.inspectionId}`}
                                    className="text-[13px] font-bold text-brand-blue-ink transition-opacity hover:opacity-70"
                                >
                                    검수 상세
                                </Link>
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
                subtitle={`${slotLabel} · ${station.name}`}
                onClose={() => {
                    changeStatus.reset();
                    setDialogOpen(false);
                }}
                pending={changeStatus.isPending}
                error={changeStatus.error}
                // 성공했을 때만 닫습니다. 실패하면 열어 둬야 오류를 읽고 다시 판단할 수 있습니다.
                onSubmit={(change) =>
                    changeStatus.mutate({ slot, change }, { onSuccess: () => setDialogOpen(false) })
                }
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
/**
 * 거래 식별자 표시.
 *
 * ERD 의 `rental_id`·`return_attempt_id`·`inspection_id` 는 UUID 뿐이라 표에 36자를 깔 수
 * 없습니다. 앞 8자만 보여주되 **전체 값에 닿을 방법을 반드시 남깁니다.**
 *   - `title` — 마우스를 올리면 36자 전체
 *   - `select-all` — 한 번 클릭으로 전체 선택돼 복사됨
 * 관리자가 백엔드 로그·문의와 대조하려면 전체 값이 필요합니다.
 *
 * 이동할 화면이 있으면(`to`) 진짜 링크로 만듭니다. 없으면 파란 글자로 만들지 않습니다 —
 * 링크처럼 보이는데 눌리지 않는 게 제일 나쁩니다.
 */
function RefId({ id, to }: { id: string | null | undefined; to?: string | null }) {
    if (!id) {
        return (
            <span className="text-brand-muted" aria-label="연결 없음">
                —
            </span>
        );
    }

    const short = shortRef(id);

    if (to) {
        return (
            <Link
                to={to}
                title={id}
                className="text-[13px] font-bold tabular-nums text-brand-blue-ink underline-offset-2 transition-opacity hover:underline hover:opacity-70"
            >
                {short}
            </Link>
        );
    }

    return (
        <span className="flex items-center justify-end gap-[6px]">
            <span
                title={id}
                className="cursor-text select-all text-[13px] font-bold tabular-nums text-brand-ink-soft"
            >
                {short}
            </span>
            {/* 화면에는 8자만 보이므로 전체 값을 꺼낼 손잡이를 답니다. */}
            <CopyButton value={id} label="반납 시도 ID" />
        </span>
    );
}

function SlotHistoryTable({ entries }: { entries: SlotHistoryEntry[] }) {
    return (
        <TableCard>
            <DataTable>
                {/*
                 * 이 표는 '언제 · 무엇이 · 어떻게 바뀌었나' 세 가지만 보여줍니다.
                 * 위 카드에 이미 있는 것은 여기서 반복하지 않습니다.
                 *
                 * 연결ID — 표시 필드의 `최근 returnAttemptId` 는 '슬롯 상태' 카드에 있습니다.
                 *   표에 36자 UUID 를 깔면 자리만 잡아먹습니다.
                 * 사유 — 되돌려받는 API 가 없습니다. `ADMIN-SLOT-STATUS-001` 과
                 *   `ADMIN-INSPECTION-003` 은 `reasonCode`·`note` 를 **받기만** 하고 조회
                 *   응답에는 그 필드가 없습니다.
                 * 검수 링크 — §7.6 `ACT-WEB-SLOT-DETAIL-004 연결 검수 이동` 은 '최근 검수'
                 *   카드의 '검수 상세에서 보기'(검수가 있으면 항상 표시)와 미처리일 때 뜨는
                 *   상단 '검수하기' 버튼이 충족합니다. 같은 목적지를 세 번 둘 이유가 없습니다.
                 */}
                <THead>
                    <Th className="w-[28%]">시각</Th>
                    <Th className="w-[24%]">구분</Th>
                    <Th align="center" className="w-[48%]">
                        상태 변화
                    </Th>
                </THead>

                <TBody>
                    {entries.map((entry) => (
                        <Tr key={`${entry.at}-${entry.kind}`} className="h-[56px]">
                            <Td className="tabular-nums">{formatUpdatedAt(entry.at)}</Td>
                            <Td className="font-bold text-brand-ink">{entry.kind}</Td>
                            <Td align="center">
                                {/*
                                 * 화살표를 열 한가운데 **고정**합니다.
                                 *
                                 * flex 로 나란히 두면 배지 글자 수에 따라('빈 슬롯' vs
                                 * '관리자 확인') 화살표 위치가 행마다 달라져서 지그재그로
                                 * 보입니다. 양옆을 `1fr` 로 잡고 가운데를 `auto` 로 두면
                                 * 화살표 x 좌표가 어느 행이든 같습니다.
                                 * 왼쪽은 오른쪽 끝에, 오른쪽은 왼쪽 끝에 붙여 화살표를 향하게 합니다.
                                 */}
                                <span className="grid grid-cols-[1fr_auto_1fr] items-center gap-[12px]">
                                    <Badge
                                        tone={SLOT_DISPLAY_TONE[entry.from]}
                                        className="justify-self-end whitespace-nowrap"
                                    >
                                        {slotStatusText(entry.from)}
                                    </Badge>
                                    <ArrowRight />
                                    <Badge
                                        tone={SLOT_DISPLAY_TONE[entry.to]}
                                        className="justify-self-start whitespace-nowrap"
                                    >
                                        {slotStatusText(entry.to)}
                                    </Badge>
                                </span>
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
