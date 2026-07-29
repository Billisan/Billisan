import { useState } from 'react';

import {
    DECISION_EFFECT,
    type InspectionDecisionInput,
    type InspectionDetail,
} from '@/features/inspections/types';
import { DECISION_TONE, decisionText, type InspectionDecision } from '@/features/stations/types';
import { Badge } from '@/shared/components/Badge';
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
    const [note, setNote] = useState('');
    const [confirmed, setConfirmed] = useState(false);

    const decided = detail.reviewStatus === 'DECIDED';
    // 화면흐름 §10.2: 판정·사유·현장 실물 확인이 다 있어야 저장할 수 있습니다.
    const canSubmit = !decided && !pending && decision !== null && note.trim() !== '' && confirmed;

    if (decided) {
        return (
            <section className="rounded-lg bg-white px-5 pb-[22px] pt-[18px]">
                <h3 className="text-[14.5px] font-extrabold leading-none text-brand-ink">
                    관리자 최종 판정
                </h3>

                <div className="mt-[18px] flex items-center gap-[10px]">
                    {detail.decision ? (
                        <Badge tone={DECISION_TONE[detail.decision]}>
                            {decisionText(detail.decision)}
                        </Badge>
                    ) : (
                        <Badge tone="slate">판정 값 없음</Badge>
                    )}
                    <span className="text-[11.5px] font-medium text-brand-muted">
                        {detail.decision && DECISION_EFFECT[detail.decision].slotState}
                    </span>
                </div>

                <p className="mt-[15px] text-[11.5px] font-semibold text-brand-body">판정 사유</p>
                <p className="mt-[6px] rounded-lg bg-brand-surface px-3 py-[11px] text-[12.5px] font-medium leading-[1.5] text-brand-ink">
                    {detail.note ?? '—'}
                </p>

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

            <label className="mt-[18px] block">
                <span className="text-[11.5px] font-semibold text-brand-body">
                    판정 사유 <span className="text-tone-red-fg">*</span>
                </span>
                <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    placeholder="현장에서 확인한 내용을 적어 두세요. 저장 후에는 이력에 그대로 남습니다."
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
                                note: note.trim(),
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
