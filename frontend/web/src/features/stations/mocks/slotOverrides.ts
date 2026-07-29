import { useSyncExternalStore } from 'react';

import type { InspectionDecisionInput } from '@/features/inspections/types';
import type { SlotStatusChange } from '@/features/stations/components/SlotStatusDialog';
import {
    buildSlotHistory,
    buildSlotOutcome,
    rentalIdOf,
    type SlotHistoryEntry,
    type SlotOutcome,
} from '@/features/stations/mocks/slotDetail';
import { deriveSlotDisplayStatus, type Slot } from '@/features/stations/types';

/**
 * 관리자 명령의 **임시** 결과 보관소.
 *
 * 백엔드가 붙기 전까지 검수 판정·슬롯 상태 변경을 눌러 볼 수 있게 메모리에만 얹어 둡니다.
 * 새로고침하면 사라지고, 서버 권위값이 아닙니다.
 *
 * TODO: ADMIN-INSPECTION-003 · ADMIN-SLOT-STATUS-001 연동 시 이 파일을 통째로 지우세요.
 *       실제 계약은 명령 성공 뒤 **서버 권위 상세를 재조회**하는 것이지, 클라이언트가
 *       결과를 만들어 내는 게 아닙니다 (화면흐름 §7.7 · API명세 B-5).
 */

interface SlotOverride {
    /** 첫 변경 직전의 슬롯. 아래 entries 는 이 상태 위에 쌓인 것입니다. */
    original: Slot;
    slot: Slot;
    /** 관리자가 만든 이력 줄. 최신순입니다. */
    entries: SlotHistoryEntry[];
    /** 마지막 판정 사유. '최근 처리 결과' 카드에 그대로 보여줍니다. */
    reason: string | null;
}

const store = new Map<string, SlotOverride>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
    version += 1;
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** 목업이 바뀔 때 화면을 다시 그리기 위한 버전 값. useMemo 의존성에 넣으세요. */
export function useSlotOverrides(): number {
    return useSyncExternalStore(
        subscribe,
        () => version,
        () => version,
    );
}

/** 서버 `DATETIME(6)` 모양의 지금 시각. 목업 안에서만 씁니다. */
function nowStamp(): string {
    const now = new Date();
    const pad = (value: number, width = 2) => String(value).padStart(width, '0');

    return (
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
        `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` +
        `.${pad(now.getMilliseconds(), 3)}000+09:00`
    );
}

function record(slot: Slot, next: Partial<Slot>, entry: SlotHistoryEntry, reason: string | null) {
    const existing = store.get(slot.slotId);

    store.set(slot.slotId, {
        original: existing?.original ?? slot,
        slot: { ...(existing?.slot ?? slot), ...next },
        entries: [entry, ...(existing?.entries ?? [])],
        reason,
    });
    emit();
}

/* ------------------------------------------------------------------ 읽기 */

/** 변경된 적이 있으면 그 결과를, 없으면 원본을 돌려줍니다. */
export function applyOverride(slot: Slot): Slot {
    return store.get(slot.slotId)?.slot ?? slot;
}

/** 관리자가 만든 줄을 원래 이력 위에 얹습니다. */
export function historyOf(slot: Slot): SlotHistoryEntry[] {
    const override = store.get(slot.slotId);
    if (!override) return buildSlotHistory(slot);

    return [...override.entries, ...buildSlotHistory(override.original)];
}

/** 판정 사유만 관리자가 실제로 적은 값으로 바꿔 줍니다. */
export function outcomeOf(slot: Slot): SlotOutcome | null {
    const outcome = buildSlotOutcome(slot);
    const override = store.get(slot.slotId);
    if (!outcome || !override?.reason) return outcome;

    return { ...outcome, reason: override.reason };
}

/* ------------------------------------------------------------------ 쓰기 */

/**
 * ADMIN-INSPECTION-003 의 결과를 흉내 냅니다.
 * 판정 → 슬롯 상태 매핑은 화면흐름 §10.2 그대로입니다.
 */
export function applyInspectionDecision(slot: Slot, input: InspectionDecisionInput) {
    const at = nowStamp();
    const from = deriveSlotDisplayStatus(slot);
    const decided = { ...slot.inspection!, reviewStatus: 'DECIDED' as const };

    const next: Partial<Slot> =
        input.decision === 'NORMAL'
            ? {
                  serviceStatus: 'AVAILABLE',
                  itemCondition: 'NORMAL',
                  inspection: decided,
                  updatedAt: at,
              }
            : input.decision === 'DAMAGED'
              ? {
                    serviceStatus: 'OUT_OF_SERVICE',
                    itemCondition: 'DAMAGED',
                    inspection: decided,
                    updatedAt: at,
                }
              : // KEEP_ADMIN_REVIEW — 검수는 미처리로, 슬롯은 ADMIN_REVIEW 로 그대로.
                {
                    serviceStatus: 'ADMIN_REVIEW',
                    itemCondition: 'UNKNOWN',
                    updatedAt: at,
                };

    record(
        slot,
        next,
        {
            at,
            kind: '검수',
            linkId: rentalIdOf(slot),
            from,
            to: deriveSlotDisplayStatus({ ...slot, ...next }),
            note: `관리자 판정 — ${input.decision}`,
            noteSub: input.note,
        },
        input.note,
    );
}

/** ADMIN-SLOT-STATUS-001 의 결과를 흉내 냅니다. 정산은 만들지 않습니다. */
export function applySlotStatusChange(slot: Slot, change: SlotStatusChange) {
    const at = nowStamp();
    const from = deriveSlotDisplayStatus(slot);

    const next: Partial<Slot> = {
        serviceStatus: change.targetServiceStatus,
        // occupancyStatus 가 EMPTY 면 itemCondition 은 null 이어야 합니다 (API명세 §3.1).
        itemCondition: slot.occupancyStatus === 'EMPTY' ? null : change.targetItemCondition,
        updatedAt: at,
    };

    record(
        slot,
        next,
        {
            at,
            kind: '상태 변경',
            linkId: null,
            from,
            to: deriveSlotDisplayStatus({ ...slot, ...next }),
            note: change.note,
            noteSub: change.physicalStateConfirmed ? '현장에서 실물 확인함' : undefined,
        },
        null,
    );
}
