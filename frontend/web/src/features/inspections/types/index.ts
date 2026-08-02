import type {
    AiInspectionResult,
    InspectionDecision,
    LockStatus,
    SlotItemCondition,
    SlotOccupancyStatus,
    SlotServiceStatus,
} from '@/features/stations/types';

/**
 * 파손 검수 — `SCR-WEB-INSPECTION-LIST-001` · `SCR-WEB-INSPECTION-DETAIL-001`.
 *
 * P0 계약 3개를 그대로 옮긴 타입입니다 (API명세 B-4).
 *   ADMIN-INSPECTION-001  GET   /api/v1/admin/inspections
 *   ADMIN-INSPECTION-002  GET   /api/v1/admin/inspections/{inspectionId}
 *   ADMIN-INSPECTION-003  PATCH /api/v1/admin/inspections/{inspectionId}/decision
 *
 * 이미지는 어떤 형태로도 들어오지 않습니다 — 원본·thumbnail·URL·path·key·Base64 전부(B-4.1).
 * 그래서 화면에도 사진 자리를 두지 않고 '왜 없는지'만 적습니다.
 *
 * 값 집합 셋을 절대 섞지 마세요.
 *   AI 결과   `NORMAL|DAMAGED|UNCERTAIN|FAILED`      ← InspectionResult (§3.1)
 *   관리자 판정 `NORMAL|DAMAGED|KEEP_ADMIN_REVIEW`     ← decision (B-4.3)
 *   슬롯 상태  serviceStatus × itemCondition          ← Slot (§3.1)
 */

/**
 * 관리자 검수 처리 여부. AI 결과가 아니라 '사람이 봤는가'입니다.
 *
 * ERD 로 보면 `DAMAGE_INSPECTION.admin_decision IS NULL` 여부에서 나오는 값입니다
 * (`status` 컬럼은 `REQUESTED|COMPLETED|FAILED` 로 **AI 추론 처리 상태**라 다른 축입니다).
 *
 * 한글 표시명은 `shared/constants/statusLabels` 에 한 벌만 둡니다.
 */
export type InspectionReviewStatus = 'PENDING' | 'DECIDED';

/** `ADMIN-INSPECTION-001` 의 `items[]` 한 줄. */
export interface InspectionListItem {
    inspectionId: string;
    /** 이 검수를 만든 반납 시도. 대여(RENTAL)가 아니라 반납(RETURN_ATTEMPT)입니다. */
    returnAttemptId: string;
    stationId: string;
    slotId: string;

    /*
     * ↓ 응답에 **없는** 필드입니다 (EC2 실측 2026-08-01: 필드셋에 미포함).
     *
     * 백엔드에 추가를 요청했지만 아직 미반영이라, 실 모드에서는 api 모듈이
     * `ADMIN-SLOT-001`(slotNumber)과 시드 명부(STATION.name)로 짜 맞춰 채웁니다.
     * 그 보강이 실패할 수 있어 **optional 입니다** — 화면은 없으면 축약 ID 로 버팁니다.
     * TODO: 백엔드가 응답에 넣어 주면 required 로 되돌리고 보강 코드를 지우세요.
     */
    /** 반납 대여소 표시 이름 — `STATION.name` */
    stationName?: string;
    /** 대여소 내 슬롯 표시 번호 — `SLOT.slot_number` */
    slotNumber?: number;
    /**
     * AI 보조 결과. 이것만으로 파손이 확정되지 않습니다 (§3.1).
     * **추론이 아직 안 끝난 검수는 null 입니다** (백엔드 실측: FAILED 가 아니어도
     * 결과가 없으면 null 을 내려줍니다).
     */
    aiResult: AiInspectionResult | null;
    /** 추론 점수. `FAILED` 는 추론 자체가 끝나지 않아 점수가 없습니다. */
    aiScore: number | null;
    modelVersion: string;
    /** 추론을 처리한 시각. '촬영 시각'이라는 필드는 계약에 없습니다. */
    processedAt: string;
    reviewStatus: InspectionReviewStatus;
    /**
     * CAS 용 최신 timestamp. `DATETIME(6)` 마이크로초 원문이라 Date 로 파싱했다가
     * 다시 만들면 자릿수가 잘려 `409 CONCURRENT_MODIFICATION` 이 항상 납니다.
     */
    updatedAt: string;
}

/**
 * `ADMIN-INSPECTION-002` 응답.
 * "검수·반납·대여·SLOT 식별자, 추론 메타데이터, 관리자 review/decision, `updatedAt` 만 제공한다."
 */
export interface InspectionDetail extends InspectionListItem {
    /** 반납 시도가 속한 대여. 정산이 붙는 단위입니다. */
    rentalId: string;
    /** 관리자 최종 판정. 미처리면 null 이고, AI 결과로 대신 채우지 않습니다. */
    decision: InspectionDecision | null;
    /** 관리자 판정 사유 코드 */
    decisionReasonCode: string | null;
    /** 관리자 판정 메모 */
    decisionNote: string | null;
    /** 판정 관리자 식별자 */
    decidedBy: string | null;
    decidedAt: string | null;

    /* 판정 화면이 현재 슬롯 상태를 같이 보여줄 수 있도록 4축이 함께 옵니다. */
    slotOccupancyStatus: SlotOccupancyStatus;
    slotItemCondition: SlotItemCondition | null;
    slotServiceStatus: SlotServiceStatus;
    slotLockStatus: LockStatus;
}

/** `ADMIN-INSPECTION-003` 요청 본문 (12-R B-5). */
export interface InspectionDecisionInput {
    decision: InspectionDecision;
    /**
     * 현장 판정 사유 코드. **필수**입니다. 없으면 `422 ADMIN_REASON_REQUIRED` 입니다.
     *
     * 명세는 타입만 `String` 이라고 하고 허용 목록을 주지 않습니다. 값을 지어낼 수 없어서
     * 입력칸으로 두고 서버가 검증하게 합니다.
     * TODO: 백엔드에서 허용 코드 목록을 받으면 select 로 바꾸세요.
     */
    reasonCode: string;
    /** 현장 확인 메모. **선택**입니다. */
    note: string | null;
    /** 현장에서 실물을 확인했는지. 이미지가 없으니 이게 판정의 근거입니다. */
    physicalStateConfirmed: boolean;
    /** 조회 응답 문자열을 그대로 되돌려 보냅니다. */
    expectedUpdatedAt: string;
}

/**
 * `ADMIN-INSPECTION-003` 응답 `data`.
 *
 * 판정 결과가 슬롯·정산 권위 상태를 통째로 돌려줍니다. 별도 재조회 없이도 화면을 갱신할 수
 * 있지만, 계약이 "성공 후 관련 목록 캐시를 무효화하고 서버 최종 상태를 다시 조회"라고 해서
 * 훅에서는 무효화 쪽을 씁니다.
 */
export interface InspectionDecisionResult {
    inspectionId: string;
    reviewStatus: InspectionReviewStatus;
    decision: InspectionDecision;
    decidedBy: string;
    decidedAt: string;
    slot: {
        slotId: string;
        occupancyStatus: SlotOccupancyStatus;
        itemCondition: SlotItemCondition | null;
        serviceStatus: SlotServiceStatus;
        lockStatus: LockStatus;
        updatedAt: string;
    };
    /** 파손 정산 결과. 정산이 없으면 null */
    settlement: {
        settlementId: string;
        reason: 'DAMAGE';
        amount: number;
        paidAmount: number;
        outstandingAmount: number;
        status: 'PENDING' | 'PAID' | 'CANCELLED';
    } | null;
    updatedAt: string;
}

/**
 * 판정 → 슬롯 상태 매핑 (API명세 B-4.3).
 *
 * `KEEP_ADMIN_REVIEW` 의 itemCondition 은 `UNKNOWN` 입니다.
 * 12번 문서 §3.1 본문은 "슬롯을 `ADMIN_REVIEW + REVIEW_REQUIRED` 로 격리한다"고 쓰지만,
 * 바로 위 `SlotItemCondition` Enum 에 `REVIEW_REQUIRED` 가 없고
 * 허용 조합도 `ADMIN_REVIEW+(UNKNOWN|DAMAGED|REPAIRABLE)` 뿐입니다. 문서 자체가 어긋난 자리라
 * Enum 쪽을 따릅니다. 백엔드 담당자 확인 대기 중입니다.
 */
export const DECISION_EFFECT: Record<
    InspectionDecision,
    { slotState: string; settlement: string }
> = {
    /*
     * `slotState` 는 **화면에 보이는 문구**입니다. 그래서 한글로 적습니다 —
     * ERD §2.4.1 "관리자 웹의 배지·표·상세 화면·안내 문구는 한글 명칭 우선",
     * "API·DB·로그 값을 화면에 직접 노출하지 않는다".
     * 예전에는 `'AVAILABLE + NORMAL'` 처럼 코드를 그대로 적어 검수 상세에서 새어 나갔습니다.
     * 코드 대조가 필요하면 배지 마우스오버(`slotStatusHint`)에 이미 `한글 · CODE` 가 있습니다.
     */
    NORMAL: { slotState: '이용 가능 · 정상', settlement: '파손 정산을 만들지 않습니다.' },
    DAMAGED: {
        slotState: '이용 중지 · 파손',
        settlement: '해당 대여에 파손 정산을 멱등 생성합니다.',
    },
    KEEP_ADMIN_REVIEW: {
        slotState: '관리자 확인 · 확인 불가',
        settlement: '검수는 미처리로 남고 정산도 만들지 않습니다.',
    },
};
