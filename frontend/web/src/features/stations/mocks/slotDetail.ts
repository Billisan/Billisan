import {
    deriveSlotDisplayStatus,
    type SlotDetail,
    type SlotDisplayStatus,
} from '@/features/stations/types';

/**
 * 슬롯 상세 화면의 **이력 표** 목업.
 *
 * `ADMIN-SLOT-DETAIL-001` 응답에는 이력 배열이 없습니다. 최근 반납 시도 1건과 최근 검수 1건
 * (`latestReturnAttempt`, `latestInspection`)만 옵니다. 아래 이력 줄은 그 두 값에서
 * 이야기를 만들어 보여주는 **화면 전용 구성**이며 서버가 주는 데이터가 아닙니다.
 *
 * 규칙 하나를 지킵니다: **최신 줄의 `to` 는 슬롯의 현재 표시 상태와 같아야 한다.**
 * 그리고 각 줄의 `from` 은 바로 아래(더 오래된) 줄의 `to` 와 이어져야 합니다.
 *
 * TODO: 이력이 계약에 들어오면 이 파일을 지우세요. 지금은 미계약 영역입니다.
 */

/** 이력 카드 한 줄 */
export interface SlotHistoryEntry {
    /** 서버 원문(DATETIME(6)). 표시할 때만 잘라 씁니다. */
    at: string;
    kind: '반납' | '대여' | '검수' | '상태 변경';
    from: SlotDisplayStatus;
    to: SlotDisplayStatus;
}

/** 'HH:mm' 에서 분을 빼 이전 시각을 만듭니다. 목업 안에서만 씁니다. */
function earlier(updatedAt: string, minutes: number): string {
    const [h, m] = updatedAt.slice(11, 16).split(':').map(Number);
    const total = Math.max(0, h * 60 + m - minutes);
    const hh = String(Math.floor(total / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return `${updatedAt.slice(0, 11)}${hh}:${mm}${updatedAt.slice(16)}`;
}

/**
 * 표시용 짧은 코드.
 *
 * ERD 의 `rental_id`·`return_attempt_id` 는 UUID 뿐이고 사람이 읽을 코드 컬럼이 없습니다.
 * 표에 36자를 깔 수 없어 앞 8자만 보여줍니다.
 *
 * **자르기는 표시 단계에서만 합니다.** 데이터에는 전체 UUID 를 담아 두고, 화면에서는
 * `title`·복사로 전체 값에 닿을 수 있게 합니다.
 */
export function shortRef(id: string | null | undefined): string | null {
    return id ? `${id.slice(0, 8)}…` : null;
}

export function buildSlotHistory(slot: SlotDetail): SlotHistoryEntry[] {
    const display = deriveSlotDisplayStatus(slot);
    const now = slot.updatedAt;
    const inspection = slot.latestInspection;

    /** 이 슬롯에서 우산이 나간 줄. 어느 갈래든 체인의 시작입니다. */
    const rentOut = (minutes: number): SlotHistoryEntry => ({
        at: earlier(now, minutes),
        kind: '대여',
        from: 'AVAILABLE',
        to: 'EMPTY',
    });

    // 검수가 없는 슬롯은 대여·반납 한 사이클만 보여줍니다.
    if (!inspection) {
        return display === 'EMPTY'
            ? [rentOut(0)]
            : [
                  {
                      at: now,
                      kind: '반납',
                      from: 'EMPTY',
                      to: display,
                  },
                  rentOut(45),
              ];
    }

    const isolate: SlotHistoryEntry = {
        at: earlier(now, 9),
        kind: '반납',
        from: 'EMPTY',
        to: 'ADMIN_REVIEW',
    };

    // 아직 관리자가 판정하지 않았습니다.
    if (inspection.reviewStatus === 'PENDING') {
        return [{ ...isolate, at: now }, rentOut(45)];
    }

    // 판정까지 끝났습니다. 결과에 따라 마지막 줄의 to 가 갈립니다.
    return [
        {
            at: now,
            kind: '검수',
            from: 'ADMIN_REVIEW',
            to: display,
        },
        isolate,
        rentOut(45),
    ];
}
