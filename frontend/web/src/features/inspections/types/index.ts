import type { AiInspectionResult, InspectionDecision } from '@/features/stations/types';

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

/**
 * `ADMIN-INSPECTION-001` 의 `items[]` 한 줄. 응답에 있는 필드가 전부입니다.
 *
 * 시안에 있던 `대여소 이름` 은 응답에 없습니다(`stationId` 만 옵니다). 목업에서는
 * 대여소 목록으로 이름을 붙여 보여주고, 실연동 때 백엔드에 `stationName` 추가를 요청해야 합니다.
 */
export interface InspectionListItem {
    inspectionId: string;
    /** 이 검수를 만든 반납 시도. 대여(RENTAL)가 아니라 반납(RETURN_ATTEMPT)입니다. */
    returnAttemptId: string;
    stationId: string;
    slotId: string;
    /** AI 보조 결과. 이것만으로 파손이 확정되지 않습니다 (§3.1). */
    aiResult: AiInspectionResult;
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
    /** 관리자가 적은 판정 사유. 미처리면 null 입니다. */
    note: string | null;
    decidedAt: string | null;
}

/** `ADMIN-INSPECTION-003` 요청 본문. */
export interface InspectionDecisionInput {
    decision: InspectionDecision;
    /**
     * 관리자가 적은 판정 사유. 없으면 서버가 `422 ADMIN_REASON_REQUIRED` 로 거절합니다.
     *
     * TODO: 본문에는 `reasonCode` 도 있는데 문서에 나오는 값이 `PHYSICAL_DAMAGE_CONFIRMED`
     *       하나뿐이라 아직 보내지 않습니다. 정작 명세의 `note` 예시가 "캐노피 찢김 확인" 이라,
     *       시안의 `CANOPY_TORN` 드롭다운은 note 로 갈 내용을 code 자리에 올려둔 것이었습니다.
     *       Enum 이 확정되면 슬롯 상태 변경 모달과 같이 고치세요.
     */
    note: string;
    /** 현장에서 실물을 확인했는지. 이미지가 없으니 이게 판정의 근거입니다. */
    physicalStateConfirmed: boolean;
    /** 조회 응답 문자열을 그대로 되돌려 보냅니다. */
    expectedUpdatedAt: string;
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
    NORMAL: { slotState: 'AVAILABLE + NORMAL', settlement: '파손 정산을 만들지 않습니다.' },
    DAMAGED: {
        slotState: 'OUT_OF_SERVICE + DAMAGED',
        settlement: '해당 대여에 파손 정산을 멱등 생성합니다.',
    },
    KEEP_ADMIN_REVIEW: {
        slotState: 'ADMIN_REVIEW + UNKNOWN',
        settlement: '검수는 미처리로 남고 정산도 만들지 않습니다.',
    },
};
