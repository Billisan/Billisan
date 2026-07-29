import { aiNoteOf, aiResultOf, aiScoreOf } from '@/features/inspections/mocks/aiVerdict';
import {
    deriveSlotDisplayStatus,
    type AiInspectionResult,
    type InspectionDecision,
    type Slot,
    type SlotDisplayStatus,
} from '@/features/stations/types';

/**
 * 슬롯 상세 화면 목업.
 *
 * 규칙 하나를 지킵니다: **이력의 최신 줄 `to` 는 슬롯의 현재 표시 상태와 같아야 한다.**
 * 그리고 각 줄의 `from` 은 바로 아래(더 오래된) 줄의 `to` 와 이어져야 합니다.
 * 이게 깨지면 "RENTED 인데 이력은 반납으로 끝나 있는" 모순이 화면에 그대로 보입니다.
 *
 * TODO: ADMIN-SLOT-DETAIL-001 `GET /api/v1/admin/slots/{slotId}` ·
 *       ADMIN-INSPECTION-002 `GET /api/v1/admin/inspections/{inspectionId}` 연동 시 이 파일을 지우세요.
 * 이미지·우산ID 는 어떤 형태로도 담지 않습니다 (화면흐름 §3.1).
 */

/** 최근 처리 결과 카드 */
export interface SlotOutcome {
    /** 이 슬롯에 마지막으로 걸렸던 대여 */
    lastRentalId: string;
    /**
     * AI 판정 결과와 신뢰도 (화면흐름 §7.6).
     * 슬롯 상태가 아니라 참고값이라 값 집합이 다릅니다.
     */
    aiVerdict: AiInspectionResult;
    /** `FAILED` 는 추론이 끝나지 않아 점수가 없습니다. */
    aiConfidence: number | null;
    /**
     * 관리자 최종 판정. 아직 미처리(PENDING)면 null 입니다.
     * AI 결과·슬롯 상태와 값 집합이 다릅니다 — 여기 `NORMAL` 은 슬롯의 `AVAILABLE` 이 아닙니다.
     */
    adminVerdict: InspectionDecision | null;
    /** 판정 사유. 판정 전이면 null 입니다. */
    reason: string | null;
    /** 이 판정을 만든 반납 시도 */
    returnAttemptId: string;
}

/** 이력 카드 한 줄 */
export interface SlotHistoryEntry {
    /** 서버 원문(DATETIME(6)). 표시할 때만 잘라 씁니다. */
    at: string;
    kind: '대여' | '반납' | '대여 종료' | '검수' | '상태 변경';
    /** 이 이력을 만든 거래. 관리자 직접 변경처럼 거래가 없으면 null 입니다. */
    linkId: string | null;
    from: SlotDisplayStatus;
    to: SlotDisplayStatus;
    /** 사유 (본문) */
    note: string;
    /** 사유 아래 회색 보조 줄 */
    noteSub?: string;
}

/** 'HH:mm' 에서 분을 빼 이전 시각을 만듭니다. 목업 안에서만 씁니다. */
function earlier(updatedAt: string, minutes: number): string {
    const [h, m] = updatedAt.slice(11, 16).split(':').map(Number);
    const total = h * 60 + m - minutes;
    const hh = String(Math.floor(total / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return `${updatedAt.slice(0, 11)}${hh}:${mm}${updatedAt.slice(16)}`;
}

/**
 * 목업 순번. slotId 는 UUID 라서 끝 4자리(대여소·슬롯 자리)를 씁니다.
 *
 * ERD 의 `RENTAL.rental_id`·`RETURN_ATTEMPT.return_attempt_id` 는 UUID 뿐이고
 * 사람이 읽을 짧은 코드 컬럼이 없습니다. 아래 'RT-0307' 류는 **목업 표시 규칙**입니다.
 * TODO: 이력 화면을 실제로 연동할 때 백엔드에 표시용 코드가 있는지 확인하세요.
 */
function seqOf(slot: Slot): number {
    return Number(slot.slotId.slice(-4)) || slot.slotNumber;
}

/** 이 슬롯에 마지막으로 걸린 대여의 표시 코드. */
export function rentalIdOf(slot: Slot): string {
    return `RT-${String(seqOf(slot)).padStart(4, '0')}`;
}

/** 한 사이클 이전 대여. 현재 대여와 자릿수를 맞춰야 표에서 어긋나 보이지 않습니다. */
function priorRentalId(slot: Slot): string {
    return `RT-${String((seqOf(slot) + 4900) % 10000).padStart(4, '0')}`;
}

export function buildSlotOutcome(slot: Slot): SlotOutcome | null {
    if (!slot.inspection) return null;

    const decided = slot.inspection.reviewStatus === 'DECIDED';
    const damaged = slot.itemCondition === 'DAMAGED' || slot.itemCondition === 'REPAIRABLE';

    return {
        lastRentalId: rentalIdOf(slot),
        // 검수 목록·검수 상세와 같은 함수에서 뽑습니다. 여기서 상수를 박으면 화면끼리 어긋납니다.
        aiVerdict: aiResultOf(slot),
        aiConfidence: aiScoreOf(slot),
        adminVerdict: decided ? (damaged ? 'DAMAGED' : 'NORMAL') : null,
        reason: decided ? (damaged ? '살대 파손' : '이상 없음') : null,
        returnAttemptId: `RA-${String(seqOf(slot)).padStart(4, '0')}`,
    };
}

export function buildSlotHistory(slot: Slot): SlotHistoryEntry[] {
    const display = deriveSlotDisplayStatus(slot);
    const rentalId = rentalIdOf(slot);
    const prior = priorRentalId(slot);
    const now = slot.updatedAt;

    /** 이 슬롯에서 우산이 나간 줄. 어느 갈래든 체인의 시작입니다. */
    const rentOut = (minutes: number): SlotHistoryEntry => ({
        at: earlier(now, minutes),
        kind: '대여',
        linkId: rentalId,
        from: 'AVAILABLE',
        to: 'RENTED',
        note: '키오스크 대여',
    });

    // AI 오탐: AI 는 파손을 의심했는데 관리자가 이상 없음으로 뒤집어 슬롯이 정상으로 돌아온 경우.
    // 표시 상태는 AVAILABLE 이지만 검수가 끝나 있어 위 default 갈래(단순 정상 반납)와 다릅니다.
    if (display === 'AVAILABLE' && slot.inspection?.reviewStatus === 'DECIDED') {
        return [
            {
                at: now,
                kind: '검수',
                linkId: rentalId,
                from: 'ADMIN_REVIEW',
                to: 'AVAILABLE',
                note: '관리자 확인 — 이상 없음',
                noteSub: `AI 참고 결과(${aiResultOf(slot)})와 관리자 판정(NORMAL)이 다릅니다`,
            },
            {
                at: earlier(now, 9),
                kind: '반납',
                linkId: rentalId,
                from: 'RENTED',
                to: 'ADMIN_REVIEW',
                note: 'AI 파손 의심 — 확정하지 않고 관리자 확인으로 격리',
                noteSub: aiNoteOf(slot),
            },
            rentOut(45),
        ];
    }

    switch (display) {
        // 지금 대여 중 → 마지막 줄이 '대여'로 끝나야 합니다.
        case 'RENTED':
            return [
                rentOut(0),
                {
                    at: earlier(now, 45),
                    kind: '반납',
                    linkId: prior,
                    from: 'RENTED',
                    to: 'AVAILABLE',
                    note: '정상 반납 처리',
                    noteSub: 'AI 참고 결과 NORMAL 0.97',
                },
                { ...rentOut(90), linkId: prior },
            ];

        // 빈 슬롯: 우산이 나간 뒤 다른 대여소에 반납돼 대여가 닫힌 경우입니다.
        case 'EMPTY':
            return [
                {
                    at: now,
                    kind: '대여 종료',
                    linkId: rentalId,
                    from: 'RENTED',
                    to: 'EMPTY',
                    note: '타 대여소 반납으로 대여 종료',
                },
                rentOut(45),
            ];

        // 반납 시도에서 AI 가 파손을 의심해 관리자 확인으로 넘어간 상태입니다.
        case 'ADMIN_REVIEW':
            return [
                {
                    at: now,
                    kind: '반납',
                    linkId: rentalId,
                    from: 'RENTED',
                    to: 'ADMIN_REVIEW',
                    note: 'AI 파손 의심 — 확정하지 않고 관리자 확인으로 격리',
                    noteSub: aiNoteOf(slot),
                },
                rentOut(45),
            ];

        // 관리자 검수까지 끝나 파손으로 확정된 상태입니다.
        case 'DAMAGED':
            return [
                {
                    at: now,
                    kind: '검수',
                    linkId: rentalId,
                    from: 'ADMIN_REVIEW',
                    to: 'DAMAGED',
                    note: '관리자 확인 — 실제 파손',
                    noteSub: '살대 파손',
                },
                {
                    at: earlier(now, 9),
                    kind: '반납',
                    linkId: rentalId,
                    from: 'RENTED',
                    to: 'ADMIN_REVIEW',
                    note: 'AI 파손 의심 — 확정하지 않고 관리자 확인으로 격리',
                    noteSub: aiNoteOf(slot),
                },
                rentOut(45),
            ];

        // AVAILABLE 포함 나머지: 정상 반납으로 끝납니다.
        default:
            return [
                {
                    at: now,
                    kind: '반납',
                    linkId: rentalId,
                    from: 'RENTED',
                    to: display,
                    note: '정상 반납 처리',
                    noteSub: 'AI 참고 결과 NORMAL 0.97',
                },
                rentOut(45),
            ];
    }
}
