import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
    deriveSlotDisplayStatus,
    SLOT_DISPLAY_TONE,
    type SlotSummary,
    type SlotDisplayStatus,
    type SlotTargetItemCondition,
    type SlotServiceStatus,
} from '@/features/stations/types';
import { Badge } from '@/shared/components/Badge';
import { cn } from '@/lib/utils';

/**
 * 슬롯 상태 변경 모달.
 *
 * ADMIN-SLOT-STATUS-001 `PATCH /api/v1/admin/slots/{slotId}/status` 요청을 그대로 만듭니다.
 * 서버가 받는 값은 두 축입니다 — `targetServiceStatus` 와 `targetItemCondition`.
 * 그래서 라디오 한 칸이 상태 하나가 아니라 **조합 하나**를 가리킵니다.
 *
 * 유효 조합(어긋나면 INVALID_SLOT_STATE_TRANSITION):
 *   AVAILABLE      + (EMPTY | NORMAL)
 *   ADMIN_REVIEW   + (UNKNOWN | DAMAGED | REPAIRABLE)
 *   OUT_OF_SERVICE + (DAMAGED | REPAIRABLE | EMPTY)
 *
 * 시안에 있던 `DISPOSED (폐기)` 는 넣지 않았습니다. API명세 §3.1 이 `DRYING`·`DISPOSED` 를
 * 신규 DB Enum 이 아니라고 못 박았고, `DISCARDED` 도 별도 처분 action 이라 P0 state 가 아닙니다.
 */

/** 관리자가 실제로 고를 만한 조합만 추립니다. */
interface Choice {
    id: string;
    label: string;
    serviceStatus: SlotServiceStatus;
    itemCondition: SlotTargetItemCondition;
    /** 미리보기 배지에 쓸 파생 상태 */
    display: SlotDisplayStatus;
    desc: string;
    /**
     * 슬롯에 우산이 들어 있어야만 고를 수 있는 선택지인지.
     *
     * `occupancyStatus = EMPTY` 면 `itemCondition = null` 이어야 합니다(API명세 §3.1).
     * 대여 중·빈 슬롯은 우산이 없으므로 우산 품질을 지정하는 선택지를 막습니다.
     * 화면흐름 §7.7 도 invalid option 은 UI 에서 비활성화하라고 합니다.
     */
    requiresItem: boolean;
}

/**
 * 시안과 같은 4줄입니다. 명세는 선택지 개수를 정하지 않고 조합의 유효성만 정합니다.
 *
 * 시안의 `DISPOSED (폐기)` 자리는 `EMPTY (빈 슬롯)` 로 바꿨습니다.
 * 폐기 자체는 `DISCARDED` 라는 별도 처분 action 이고 P0 state 가 아닙니다(API명세 §3.1).
 * 화면흐름 WF-WEB-CHANGE-003 도 이 항목을 빼고 '회수 후 슬롯 비움'으로 표현하라고 합니다.
 *
 * 다만 **폐기 이후 슬롯이 EMPTY 인지 OUT_OF_SERVICE 유지인지는 아직 미정입니다**
 * (화면흐름 DEC-WEB-002 / §17 에서 DEFERRED_NOT_CONTRACTED). 여기 EMPTY 는 '우산을 빼낸 상태'
 * 라는 뜻으로만 쓴 것이고, 폐기 절차의 최종 상태로 확정한 게 아닙니다. 확정되면 이 줄을 고치세요.
 *
 * 여기 없어서 이 화면으로는 못 가는 조합: `REPAIRABLE`(수리 가능), `OUT_OF_SERVICE+EMPTY`,
 * `ADMIN_REVIEW+(DAMAGED|REPAIRABLE)`. 필요해지면 줄만 더하면 됩니다.
 */
const CHOICES: Choice[] = [
    {
        id: 'available-normal',
        label: 'AVAILABLE (사용 가능)',
        serviceStatus: 'AVAILABLE',
        itemCondition: 'NORMAL',
        display: 'AVAILABLE',
        desc: '정상 우산이 들어 있고 바로 대여할 수 있는 상태로 되돌립니다.',
        requiresItem: true,
    },
    {
        id: 'oos-damaged',
        label: 'DAMAGED (파손)',
        serviceStatus: 'OUT_OF_SERVICE',
        itemCondition: 'DAMAGED',
        display: 'DAMAGED',
        desc: '파손으로 확정하고 운영에서 내립니다. 검수에서 DAMAGED 판정을 냈을 때와 같은 결과입니다.',
        requiresItem: true,
    },
    {
        id: 'available-empty',
        label: 'EMPTY (빈 슬롯)',
        serviceStatus: 'AVAILABLE',
        itemCondition: 'EMPTY',
        display: 'EMPTY',
        desc: '우산을 빼낸 상태입니다. 대여는 안 되고 반납은 받을 수 있습니다.',
        requiresItem: false,
    },
    {
        id: 'review-unknown',
        label: 'ADMIN_REVIEW (관리자 확인)',
        serviceStatus: 'ADMIN_REVIEW',
        itemCondition: 'UNKNOWN',
        display: 'ADMIN_REVIEW',
        desc: '판정을 보류합니다. 검수 목록에 미처리로 남습니다.',
        requiresItem: true,
    },
];

/**
 * ADMIN-SLOT-STATUS-001 요청 본문.
 *
 * 12-R B-4 기준으로 `reasonCode` 는 **필수**, `note` 는 선택입니다.
 */
export interface SlotStatusChange {
    targetServiceStatus: SlotServiceStatus;
    targetItemCondition: SlotTargetItemCondition;
    /**
     * 변경 사유 코드. **필수**입니다. 없으면 `422 ADMIN_REASON_REQUIRED` 로 거절됩니다.
     *
     * 명세는 "자유 상태값이 아니라 **서버가 허용한 코드**"라고만 하고 목록을 주지 않습니다.
     * 값을 지어낼 수 없어서 지금은 입력칸으로 두고, 서버가 검증합니다.
     * TODO: 백엔드에서 허용 코드 목록을 받으면 select 로 바꾸세요.
     */
    reasonCode: string;
    /** 현장 확인 메모. 선택입니다. */
    note: string;
    physicalStateConfirmed: boolean;
    /** 조회 응답 문자열을 그대로 되돌려 보냅니다. Date 로 파싱하면 마이크로초가 잘립니다. */
    expectedUpdatedAt: string;
}

interface SlotStatusDialogProps {
    open: boolean;
    slot: SlotSummary;
    /** 'SL-03-06 · 제1공학관(ST-003)' 형태의 부제 */
    subtitle: string;
    onClose: () => void;
    onSubmit: (change: SlotStatusChange) => void;
}

export function SlotStatusDialog({
    open,
    slot,
    subtitle,
    onClose,
    onSubmit,
}: SlotStatusDialogProps) {
    const current = deriveSlotDisplayStatus(slot);

    const [choiceId, setChoiceId] = useState(CHOICES[3].id);
    const [reasonCode, setReasonCode] = useState('');
    const [note, setNote] = useState('');
    const [confirmed, setConfirmed] = useState(false);

    // 다시 열 때마다 초깃값으로 되돌립니다. 직전 입력이 남아 있으면 오조작이 납니다.
    useEffect(() => {
        if (!open) return;
        // 우산이 없는 슬롯이면 기본 선택도 우산을 전제하지 않는 것으로 둡니다.
        setChoiceId(slot.occupancyStatus === 'OCCUPIED' ? CHOICES[3].id : CHOICES[2].id);
        setReasonCode('');
        setNote('');
        setConfirmed(false);
    }, [open, slot.occupancyStatus]);

    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const choice = CHOICES.find((item) => item.id === choiceId) ?? CHOICES[0];
    // 우산이 슬롯에 없으면 우산 품질을 지정하는 선택지는 고를 수 없습니다.
    const hasItem = slot.occupancyStatus === 'OCCUPIED';
    const unchanged =
        choice.serviceStatus === slot.serviceStatus && choice.itemCondition === slot.itemCondition;
    // reasonCode 가 필수라 그것부터 봅니다. note 는 선택입니다 (12-R B-4).
    const canSubmit = !unchanged && reasonCode.trim() !== '' && (hasItem || !choice.requiresItem);

    const handleSubmit = () => {
        if (!canSubmit) return;
        onSubmit({
            targetServiceStatus: choice.serviceStatus,
            targetItemCondition: choice.itemCondition,
            reasonCode: reasonCode.trim(),
            note: note.trim(),
            physicalStateConfirmed: confirmed,
            expectedUpdatedAt: slot.updatedAt,
        });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#0B1220]/40 p-6"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal
                aria-labelledby="slot-status-dialog-title"
                className="my-auto w-[452px] rounded-[14px] bg-white px-[30px] pb-[28px] pt-[26px] shadow-[0_8px_28px_rgba(11,18,32,0.16)]"
            >
                <div className="flex items-start">
                    <h2
                        id="slot-status-dialog-title"
                        className="text-[18px] font-extrabold leading-none text-brand-ink"
                    >
                        슬롯 상태 변경
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="-mr-1 -mt-1 ml-auto rounded-md p-1 text-brand-muted transition-colors hover:bg-brand-surface"
                    >
                        <span className="sr-only">닫기</span>
                        <X className="size-[14px]" strokeWidth={1.8} aria-hidden />
                    </button>
                </div>

                <p className="mt-[10px] text-[13px] font-medium text-brand-body">{subtitle}</p>

                <hr className="my-[20px] border-brand-line" />

                <div className="flex h-[22px] items-center gap-4">
                    <span className="text-[12.5px] font-medium text-brand-body">현재 상태</span>
                    <Badge tone={SLOT_DISPLAY_TONE[current]}>{current}</Badge>
                </div>

                <fieldset className="mt-[22px]">
                    <legend className="mb-[14px] text-[13px] font-bold text-brand-ink">
                        변경할 상태
                    </legend>

                    <div className="space-y-[12px]">
                        {CHOICES.map((item) => {
                            const active = item.id === choiceId;
                            const blocked = item.requiresItem && !hasItem;

                            return (
                                <label
                                    key={item.id}
                                    className={cn(
                                        'flex h-[22px] items-center gap-[12px]',
                                        blocked
                                            ? 'cursor-not-allowed opacity-40'
                                            : 'cursor-pointer',
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name="slot-status"
                                        value={item.id}
                                        checked={active}
                                        disabled={blocked}
                                        onChange={() => setChoiceId(item.id)}
                                        className="peer sr-only"
                                    />
                                    {/* 시안의 라디오는 16px 원, 선택 시 파란 2px 테두리 + 8px 점입니다. */}
                                    <span
                                        className={cn(
                                            'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-blue/40',
                                            active
                                                ? 'border-2 border-brand-blue'
                                                : 'border-[1.5px] border-[#CBD2DC]',
                                        )}
                                        aria-hidden
                                    >
                                        {active && (
                                            <span className="size-2 rounded-full bg-brand-blue" />
                                        )}
                                    </span>
                                    <span
                                        className={cn(
                                            'text-[13px]',
                                            active
                                                ? 'font-bold text-brand-ink'
                                                : 'font-medium text-brand-body',
                                        )}
                                    >
                                        {item.label}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </fieldset>

                <p className="mt-[18px] rounded-lg bg-brand-surface px-5 py-[16px] text-[12.5px] font-medium leading-[20px] text-brand-muted">
                    {choice.desc}
                    {!hasItem && (
                        <span className="mt-[6px] block text-brand-body">
                            이 슬롯은 지금 비어 있어 우산 상태를 지정하는 선택지는 고를 수 없습니다.
                        </span>
                    )}
                </p>

                {/*
                 * 명세가 요구하는 두 칸입니다 — `reasonCode`(필수) · `note`(선택).
                 * 허용 코드 목록이 문서에 없어서 값을 지어내지 않고 입력칸으로 둡니다.
                 */}
                <label className="mt-[18px] block">
                    <span className="mb-[8px] block text-[13px] font-bold text-brand-ink">
                        사유 코드 <span className="text-tone-red-fg">*</span>
                    </span>
                    <input
                        value={reasonCode}
                        onChange={(event) => setReasonCode(event.target.value)}
                        placeholder="서버가 허용한 사유 코드"
                        className="h-[38px] w-full rounded-lg border border-brand-border-soft bg-white px-[14px] text-[12.5px] font-medium text-brand-ink outline-none placeholder:text-brand-muted focus-visible:ring-2 focus-visible:ring-brand-blue/40"
                    />
                </label>

                <label className="mt-[14px] block">
                    <span className="mb-[8px] block text-[13px] font-bold text-brand-ink">
                        메모
                    </span>
                    <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        rows={2}
                        placeholder="현장에서 확인한 내용을 적어 두세요 (선택)"
                        className="w-full resize-none rounded-lg border border-brand-border-soft bg-white px-[14px] py-[10px] text-[12.5px] font-medium leading-[19px] text-brand-ink outline-none placeholder:text-brand-muted focus-visible:ring-2 focus-visible:ring-brand-blue/40"
                    />
                </label>

                <label className="mt-[14px] flex cursor-pointer items-center gap-[10px]">
                    <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(event) => setConfirmed(event.target.checked)}
                        className="size-4 accent-brand-blue"
                    />
                    <span className="text-[12.5px] font-medium text-brand-body">
                        현장에서 실물을 확인했습니다
                    </span>
                </label>

                <div className="mt-[20px] flex h-[22px] items-center gap-[12px]">
                    <Badge tone={SLOT_DISPLAY_TONE[current]}>{current}</Badge>
                    <span className="text-brand-muted" aria-hidden>
                        →
                    </span>
                    <Badge tone={SLOT_DISPLAY_TONE[choice.display]}>{choice.display}</Badge>
                    {unchanged && (
                        <span className="ml-auto text-[12px] font-medium text-brand-muted">
                            바뀌는 값이 없습니다
                        </span>
                    )}
                </div>

                <div className="mt-[16px] flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-11 flex-1 rounded-lg border border-brand-border-soft bg-white text-[13.5px] font-bold text-brand-body transition-colors hover:bg-brand-surface"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        disabled={!canSubmit}
                        onClick={handleSubmit}
                        className="h-11 flex-1 rounded-lg bg-brand-blue text-[13.5px] font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:bg-brand-blue/40"
                    >
                        변경
                    </button>
                </div>
            </div>
        </div>
    );
}
