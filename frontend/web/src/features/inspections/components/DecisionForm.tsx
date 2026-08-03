import { useState } from 'react';

import {
    DECISION_EFFECT,
    type InspectionDecisionInput,
    type InspectionDetail,
} from '@/features/inspections/types';
import {
    DECISION_TONE,
    decisionHint,
    decisionText,
    type InspectionDecision,
} from '@/features/stations/types';
import { Badge } from '@/shared/components/Badge';
import { RefId } from '@/shared/components/RefId';
import { cn } from '@/lib/utils';

/**
 * 관리자 최종 판정 — `ADMIN-INSPECTION-003`.
 *
 * 라디오 한 칸이 곧 `decision` 값입니다. 라벨에 슬롯 상태(`AVAILABLE` 등)를 쓰지 않습니다.
 * 판정 값과 슬롯 상태는 다른 집합이고, 화면흐름 §17 이 "`DAMAGED` decision 과 item state 를
 * 혼동하지 않는다"고 못 박았습니다. 판정이 만드는 슬롯 상태는 설명 줄로만 보여줍니다.
 *
 * 시안(15번)의 `사유 코드 (필수)` 드롭다운은 넣지 않았습니다. 문서에 나오는 `reasonCode` 는
 * `PHYSICAL_DAMAGE_CONFIRMED` 하나뿐이고, 시안이 고르게 한 `CANOPY_TORN · 캐노피 찢어짐` 은
 * 정작 명세에서 `note` 의 예시값("캐노피 찢김 확인")입니다. 자유 입력 한 칸으로 둡니다.
 */

const DECISIONS: InspectionDecision[] = ['NORMAL', 'DAMAGED', 'KEEP_ADMIN_REVIEW'];

export function DecisionForm({
    detail,
    onSubmit,
    onCancel,
    pending = false,
    error,
}: {
    detail: InspectionDetail;
    onSubmit: (input: InspectionDecisionInput) => void;
    onCancel: () => void;
    pending?: boolean;
    /** 저장 실패. 409·422 는 자동 재시도하지 않고 그대로 보여 줍니다 (전부 retryable=false). */
    error?: Error | null;
}) {
    const [decision, setDecision] = useState<InspectionDecision | null>(null);
    const [reasonCode, setReasonCode] = useState('');
    const [note, setNote] = useState('');
    const [confirmed, setConfirmed] = useState(false);

    const decided = detail.reviewStatus === 'DECIDED';
    /*
     * 화면흐름 §10.2: 판정·사유·현장 실물 확인이 다 있어야 저장할 수 있습니다.
     *
     * **`note` 가 아니라 `reasonCode` 를 봅니다.** 예전에는 반대였습니다 — 선택 필드인
     * 메모를 채워야 버튼이 열리고, 정작 필수인 사유 코드는 비어도 통과했습니다.
     * 화면은 「사유 코드 *」로 필수 표시를 하고 있어서 말과 동작이 어긋났고,
     * 서버는 빈 `reasonCode` 에 `422 ADMIN_REASON_REQUIRED` 를 냅니다 (12-R B-5).
     * 관리자가 시키는 대로 채웠는데 저장이 실패하는 자리였습니다.
     */
    const canSubmit =
        !decided && !pending && decision !== null && reasonCode.trim() !== '' && confirmed;

    if (decided) {
        return (
            <section className="rounded-lg bg-white px-5 pb-[22px] pt-[18px]">
                <h3 className="text-[14.5px] font-extrabold leading-none text-brand-ink">
                    관리자 최종 판정
                </h3>

                {/*
                 * 배지 옆의 슬롯 결과(`DECISION_EFFECT[...].slotState`, 예: 「이용 가능 · 정상」)
                 * 는 뺐습니다. 판정이 끝난 화면에서는 **지금 슬롯이 실제로 어떤 상태인지**를
                 * 아래 「현재 슬롯 상태」 카드가 네 축 그대로 보여 줍니다. 판정 시점의 예상
                 * 결과를 옆에 또 적으면 같은 것을 두 번 말하는 셈이고, 그 뒤 슬롯 상태를
                 * 따로 바꿨다면 둘이 어긋나 보입니다. 이 문구는 아직 판정 전인 폼 쪽에
                 * (무엇이 바뀔지 미리 알려 주는 자리) 그대로 남아 있습니다.
                 */}
                <div className="mt-[18px] flex items-center gap-[10px]">
                    {detail.decision ? (
                        <Badge
                            tone={DECISION_TONE[detail.decision]}
                            title={decisionHint(detail.decision)}
                        >
                            {decisionText(detail.decision)}
                        </Badge>
                    ) : (
                        <Badge tone="slate">판정 값 없음</Badge>
                    )}
                </div>

                {/*
                 * **값이 없으면 줄째로 숨깁니다.**
                 *
                 * 사유 코드·메모는 관리자가 파손을 확정할 때 적는 값이라, 정상 판정 건에는
                 * 아예 없습니다. 그런 건에서 제목만 남기고 `—` 를 깔아 두면 화면 절반이
                 * 빈칸이 되고, 「적었어야 하는데 빠진 것」처럼 읽힙니다. 없는 값은 없는
                 * 대로 두는 편이 정확합니다 — 파손 건에서는 지금처럼 그대로 나옵니다.
                 */}
                {detail.decisionReasonCode && (
                    <>
                        <p className="mt-[15px] text-[11.5px] font-semibold text-brand-body">
                            사유 코드
                        </p>
                        <p className="mt-[6px] text-[12.5px] font-bold text-brand-ink">
                            {detail.decisionReasonCode}
                        </p>
                    </>
                )}

                {detail.decisionNote && (
                    <>
                        <p className="mt-[13px] text-[11.5px] font-semibold text-brand-body">
                            메모
                        </p>
                        <p className="mt-[6px] rounded-lg bg-brand-surface px-3 py-[11px] text-[12.5px] font-medium leading-[1.5] text-brand-ink">
                            {detail.decisionNote}
                        </p>
                    </>
                )}

                {/*
                 * **누가 언제 판정했는지.** `ADMIN-INSPECTION-002` 가 `decidedBy`·`decidedAt`
                 * 을 주는데 화면에 안 그리고 있었습니다. 판정은 슬롯·정산을 함께 바꾸는
                 * 확정 행위라, 나중에 "이 파손 정산이 왜 생겼나"를 되짚을 때 사유·메모만으로는
                 * 부족합니다.
                 *
                 * 관리자 UUID 는 `RefId` 로 보여 줍니다 — 검수 상세의 검수·반납·대여 ID 와
                 * 같은 표시입니다. 예전에는 손으로 자른 글자에 `title`·`select-all` 만 있고
                 * **복사 버튼이 없어서**, 한 화면 안에서 어떤 UUID 는 눌러 복사되고 어떤 건
                 * 안 되는 상태였습니다. 전체 값이 필요한 이유가 같으니 표시도 같아야 합니다.
                 */}
                <dl className="mt-[14px] flex gap-6">
                    <div>
                        <dt className="text-[11.5px] font-semibold text-brand-body">판정 시각</dt>
                        <dd className="mt-[5px] text-[12.5px] font-bold tabular-nums text-brand-ink">
                            {detail.decidedAt
                                ? `${detail.decidedAt.slice(0, 10)} ${detail.decidedAt.slice(11, 19)}`
                                : '—'}
                        </dd>
                    </div>
                    <div className="min-w-0">
                        <dt className="text-[11.5px] font-semibold text-brand-body">판정 관리자</dt>
                        <dd className="mt-[5px]">
                            <RefId id={detail.decidedBy} label="판정 관리자" />
                        </dd>
                    </div>
                </dl>

                {/*
                 * 이미 판정된 검수는 다시 저장할 수 없습니다.
                 * 서버도 `409 INSPECTION_ALREADY_DECIDED` 로 막습니다.
                 */}
                <p className="mt-[14px] text-[11px] font-medium text-brand-muted">
                    이미 판정이 끝난 검수입니다. 되돌리려면 슬롯 상태 변경으로 처리하세요.
                </p>
            </section>
        );
    }

    return (
        <section className="rounded-lg bg-white px-5 pb-[20px] pt-[18px]">
            <h3 className="text-[14.5px] font-extrabold leading-none text-brand-ink">
                관리자 최종 판정
            </h3>

            <fieldset className="mt-[20px]">
                <legend className="sr-only">판정 선택</legend>
                <div className="space-y-[17px]">
                    {DECISIONS.map((value) => (
                        <DecisionRadio
                            key={value}
                            decision={value}
                            checked={decision === value}
                            onSelect={() => setDecision(value)}
                        />
                    ))}
                </div>
            </fieldset>

            {/* 이미지가 없으니 '현장에서 봤다'가 판정의 유일한 근거입니다. */}
            <label className="mt-[20px] flex cursor-pointer items-center gap-[10px]">
                <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="size-4 shrink-0 accent-brand-blue"
                />
                <span className="text-[12px] font-semibold text-brand-ink">
                    현장에서 실물 상태를 확인했습니다 <span className="text-tone-red-fg">*</span>
                </span>
            </label>

            {/*
             * 명세가 요구하는 두 칸입니다 — `reasonCode`(필수) · `note`(선택).
             * 허용 코드 목록이 문서에 없어서 값을 지어내지 않고 입력칸으로 둡니다.
             */}
            <label className="mt-[18px] block">
                <span className="text-[11.5px] font-semibold text-brand-body">
                    사유 코드 <span className="text-tone-red-fg">*</span>
                </span>
                <input
                    value={reasonCode}
                    onChange={(event) => setReasonCode(event.target.value)}
                    placeholder="서버가 허용한 사유 코드"
                    className="mt-[7px] h-[38px] w-full rounded-lg bg-brand-surface px-3 text-[12.5px] font-medium text-brand-ink outline-none transition-shadow placeholder:text-brand-placeholder focus-visible:ring-2 focus-visible:ring-brand-blue/40"
                />
            </label>

            <label className="mt-[14px] block">
                <span className="text-[11.5px] font-semibold text-brand-body">메모</span>
                <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    placeholder="현장에서 확인한 내용을 적어 두세요 (선택)"
                    className="mt-[7px] h-[70px] w-full resize-none rounded-lg bg-brand-surface px-3 py-[10px] text-[12.5px] font-medium leading-[1.5] text-brand-ink outline-none transition-shadow placeholder:text-brand-placeholder focus-visible:ring-2 focus-visible:ring-brand-blue/40"
                />
            </label>

            {error && (
                <p role="alert" className="mt-[12px] text-[11.5px] font-semibold text-tone-red-fg">
                    {error.message}
                </p>
            )}

            <hr className="my-[16px] border-brand-line-soft" />

            <div className="flex items-center justify-between gap-4">
                {/* CAS 기준값을 화면에도 적어 둡니다. 409 가 났을 때 무엇이 밀렸는지 보이게. */}
                <p className="text-[10.8px] font-medium leading-[1.5] text-brand-muted">
                    expectedUpdatedAt {detail.updatedAt.slice(11, 23)} 기준
                    <br />
                    충돌 시 최신 상태를 다시 조회합니다
                </p>
                <div className="flex shrink-0 items-center gap-[10px]">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="h-[38px] w-[56px] rounded-[7px] border border-brand-border-soft text-[12.5px] font-bold text-brand-body transition-colors hover:bg-brand-surface"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        disabled={!canSubmit}
                        onClick={() => {
                            if (!canSubmit || decision === null) return;
                            onSubmit({
                                decision,
                                reasonCode: reasonCode.trim(),
                                note: note.trim() || null,
                                physicalStateConfirmed: confirmed,
                                // 조회 응답 문자열을 그대로 되돌려 보냅니다 (마이크로초 보존).
                                expectedUpdatedAt: detail.updatedAt,
                            });
                        }}
                        className="h-[38px] w-[86px] rounded-[7px] bg-brand-blue text-[12.5px] font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:bg-brand-border-soft disabled:text-brand-muted"
                    >
                        {pending ? '저장 중…' : '판정 저장'}
                    </button>
                </div>
            </div>
        </section>
    );
}

function DecisionRadio({
    decision,
    checked,
    onSelect,
}: {
    decision: InspectionDecision;
    checked: boolean;
    onSelect: () => void;
}) {
    const effect = DECISION_EFFECT[decision];

    return (
        <label className="flex cursor-pointer items-start gap-[11px]">
            <input
                type="radio"
                name="inspection-decision"
                className="sr-only"
                checked={checked}
                onChange={onSelect}
            />
            {/* 시안 기준 지름 16px, 선택 시 안쪽 점 8px. */}
            <span
                className={cn(
                    'mt-[1px] flex size-4 shrink-0 items-center justify-center rounded-full border bg-white',
                    checked ? 'border-2 border-brand-blue' : 'border-[#CBD2DC]',
                )}
            >
                {checked && <span className="block size-2 rounded-full bg-brand-blue" />}
            </span>
            <span className="min-w-0">
                <span
                    className={cn(
                        'block text-[12.5px] font-bold leading-none',
                        checked ? 'text-brand-ink' : 'text-brand-body',
                    )}
                >
                    {decisionText(decision)}
                </span>
                <span className="mt-[6px] block text-[11px] font-medium leading-[1.45] text-brand-muted">
                    슬롯 {effect.slotState} · {effect.settlement}
                </span>
            </span>
        </label>
    );
}
