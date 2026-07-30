import { useSyncExternalStore } from 'react';

import type { InspectionDecisionInput } from '@/features/inspections/types';
import type { SlotStatusChange } from '@/features/stations/components/SlotStatusDialog';
import type { SlotSummary } from '@/features/stations/types';

/**
 * 관리자 명령의 **임시** 결과 보관소.
 *
 * 백엔드가 붙기 전까지 검수 판정·슬롯 상태 변경을 눌러 볼 수 있게 메모리에만 얹어 둡니다.
 * 새로고침하면 사라지고, 서버 권위값이 아닙니다.
 *
 * TODO: ADMIN-INSPECTION-003 · ADMIN-SLOT-STATUS-001 연동 시 이 파일을 통째로 지우세요.
 *       실제 계약은 명령 성공 뒤 **서버 권위 상세를 재조회**하는 것이지, 클라이언트가
 *       결과를 만들어 내는 게 아닙니다 (12-R B-6).
 */

interface SlotOverride {
    /** 4축 변경분 */
    patch: Partial<SlotSummary>;
    /** 검수가 확정됐는지. 슬롯 목록 응답에는 없는 값이라 여기서만 들고 있습니다. */
    inspectionDecided: boolean;
    /** 관리자가 적은 판정 사유 코드·메모 */
    reasonCode: string | null;
    note: string | null;
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

/** 목업이 바뀔 때 화면을 다시 그리기 위한 버전 값. */
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

/* ------------------------------------------------------------------ 읽기 */

/**
 * 변경된 적이 있으면 그 결과를 얹어 돌려줍니다.
 *
 * 제네릭인 이유: 목록(`SlotSummary`)과 상세(`SlotDetail`) 둘 다 통과시켜야 하는데,
 * 상세로 들어온 값을 `SlotSummary` 로 좁혀 반환하면 `latestInspection` 같은 필드가 날아갑니다.
 */
export function applyOverride<T extends SlotSummary>(slot: T): T {
    const override = store.get(slot.slotId);
    return override ? { ...slot, ...override.patch } : slot;
}

/** 이 슬롯의 검수가 관리자 판정으로 확정됐는지 (목업 전용). */
export function isInspectionDecided(slotId: string): boolean {
    return store.get(slotId)?.inspectionDecided ?? false;
}

/** 관리자가 실제로 적은 판정 사유. 검수 상세에서 그대로 보여줍니다. */
export function decisionInputOf(slotId: string): {
    reasonCode: string | null;
    note: string | null;
} {
    const override = store.get(slotId);
    return { reasonCode: override?.reasonCode ?? null, note: override?.note ?? null };
}

/* ------------------------------------------------------------------ 쓰기 */

function record(slotId: string, next: SlotOverride) {
    const existing = store.get(slotId);
    store.set(slotId, {
        patch: { ...(existing?.patch ?? {}), ...next.patch },
        inspectionDecided: next.inspectionDecided,
        reasonCode: next.reasonCode,
        note: next.note,
    });
    emit();
}

/**
 * `ADMIN-INSPECTION-003` 의 결과를 흉내 냅니다.
 * 판정 → 슬롯 상태 매핑은 12-R B-5 그대로입니다.
 */
export function applyInspectionDecision(slot: SlotSummary, input: InspectionDecisionInput) {
    const at = nowStamp();

    const patch: Partial<SlotSummary> =
        input.decision === 'NORMAL'
            ? { serviceStatus: 'AVAILABLE', itemCondition: 'NORMAL', updatedAt: at }
            : input.decision === 'DAMAGED'
              ? { serviceStatus: 'OUT_OF_SERVICE', itemCondition: 'DAMAGED', updatedAt: at }
              : // KEEP_ADMIN_REVIEW — 검수는 미처리로, 슬롯은 ADMIN_REVIEW 로 그대로.
                { serviceStatus: 'ADMIN_REVIEW', itemCondition: 'UNKNOWN', updatedAt: at };

    record(slot.slotId, {
        patch,
        // 보류는 검수를 확정하지 않습니다.
        inspectionDecided: input.decision !== 'KEEP_ADMIN_REVIEW',
        reasonCode: input.reasonCode,
        note: input.note ?? null,
    });
}

/**
 * `ADMIN-SLOT-STATUS-001` 의 결과를 흉내 냅니다. 정산은 만들지 않습니다.
 *
 * **점유 상태(`occupancyStatus`)는 요청에 없습니다.** 계약상 "센서·서버가 확정한" 값이고
 * 응답으로 돌려받습니다. 그러니 여기서 정하는 건 서버 흉내일 뿐이고, 실제 연동 뒤에는
 * 서버가 준 값을 그대로 써야 합니다.
 *
 * 그래도 아무 값이나 두면 안 됩니다. 조회 응답의 불변식이 "점유가 `EMPTY` 이면
 * `itemCondition` 은 `null`" 이므로, 뒤집으면 **품질이 정해졌다는 건 우산이 들어 있다는 뜻**
 * 입니다. 그래서 목표 품질에서 점유를 되짚습니다.
 *
 * 이걸 안 하면 우산을 채워 넣어도 슬롯이 영영 '빈 슬롯' 으로 남습니다.
 */
export function applySlotStatusChange(slot: SlotSummary, change: SlotStatusChange) {
    const occupancyStatus =
        change.targetItemCondition === 'EMPTY'
            ? 'EMPTY'
            : // UNKNOWN 은 '품질을 모른다' 일 뿐이라 실물 유무를 단정하지 않습니다. 그대로 둡니다.
              change.targetItemCondition === 'UNKNOWN'
              ? slot.occupancyStatus
              : 'OCCUPIED';

    record(slot.slotId, {
        patch: {
            serviceStatus: change.targetServiceStatus,
            occupancyStatus,
            /*
             * 빈 슬롯에는 품질이 없습니다 (12-R B-4).
             * 빈 슬롯에 '관리자 확인' 을 걸면 여기로 옵니다 — 품질은 `null` 이고 서비스 상태만
             * `ADMIN_REVIEW` 입니다. 우산이 사라진 슬롯을 사람이 봐야 하는, 실제로 있는 상황입니다.
             */
            itemCondition:
                change.targetItemCondition === 'EMPTY' || occupancyStatus === 'EMPTY'
                    ? null
                    : change.targetItemCondition,
            updatedAt: nowStamp(),
        },
        inspectionDecided: isInspectionDecided(slot.slotId),
        reasonCode: change.reasonCode,
        note: change.note ?? null,
    });
}
