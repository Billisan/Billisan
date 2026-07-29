/**
 * 상태 코드 → 화면 표시명.
 *
 * ERD §2.4.1 이 정한 규칙입니다:
 *   "사용자 앱·키오스크·**관리자 웹**의 배지, 표, 상세 화면, 안내 문구는 한글 명칭 우선으로 표시한다."
 *   "API·DB·로그 값을 화면에 직접 노출하지 않고, **프론트엔드의 공통 상태 라벨 매핑**을 통해 변환한다."
 *   표기법: `한글 명칭(CODE)` — 예 `대여 중(ACTIVE)`, `관리자 확인 필요(ADMIN_REVIEW)`
 *
 * 아래 한글명은 전부 ERD 의 "표시 기준" 표에서 그대로 가져온 값입니다. 임의로 짓지 마세요.
 * 새 상태를 추가할 때도 ERD 가 "한글 표시명·코드·의미를 함께 정의한 후 사용한다"고 정했습니다.
 *
 * DB 저장값·API 원문·로그는 영문 코드 그대로 씁니다. 바뀌는 건 화면에 찍는 글자뿐입니다.
 */

/** `STATION.service_status` */
export const STATION_SERVICE_LABEL = {
    AVAILABLE: '운영 중',
    MAINTENANCE: '점검 중',
    OFFLINE: '운영 중단',
} as const;

/** `STATION.device_status` */
export const DEVICE_STATUS_LABEL = {
    ONLINE: '장치 연결',
    OFFLINE: '장치 연결 끊김',
    ERROR: '장치 오류',
} as const;

/** `SLOT.service_status` */
export const SLOT_SERVICE_LABEL = {
    AVAILABLE: '이용 가능',
    ADMIN_REVIEW: '관리자 확인',
    OUT_OF_SERVICE: '이용 중지',
} as const;

/** `SLOT.item_condition` */
export const ITEM_CONDITION_LABEL = {
    EMPTY: '빈 슬롯',
    NORMAL: '정상',
    DAMAGED: '파손',
    REPAIRABLE: '수리 가능',
    UNKNOWN: '확인 필요',
} as const;

/** `DAMAGE_INSPECTION.ai_result` */
export const AI_RESULT_LABEL = {
    NORMAL: '정상 판정',
    DAMAGED: '파손 의심',
    UNCERTAIN: '판정 불가',
    FAILED: '검수 실패',
} as const;

/**
 * `DAMAGE_INSPECTION.admin_decision`
 *
 * `NORMAL`·`DAMAGED` 는 ERD 표시 기준 그대로입니다.
 * `KEEP_ADMIN_REVIEW` 는 `ADMIN-INSPECTION-003` 이 받는 세 번째 값인데 **ERD 표시 기준 표에는
 * 없습니다**. ERD 규칙에 따라 임시 표시명을 정해 쓰되, 백엔드 담당자와 확정해야 합니다.
 */
export const DECISION_LABEL = {
    NORMAL: '관리자 정상 판정',
    DAMAGED: '관리자 파손 판정',
    KEEP_ADMIN_REVIEW: '판정 보류',
} as const;

/**
 * 표에 한 칸으로 보여줄 파생 슬롯 상태.
 *
 * `RENTED` 는 슬롯 Enum 이 아니라 활성 대여 연결에서 파생합니다. ERD §2.4.1 의 예시가
 * `대여 중(ACTIVE)` 라서 한글명을 거기 맞춥니다.
 */
export const SLOT_DISPLAY_LABEL = {
    AVAILABLE: '이용 가능',
    RENTED: '대여 중',
    EMPTY: '빈 슬롯',
    DAMAGED: '파손',
    ADMIN_REVIEW: '관리자 확인',
    OUT_OF_SERVICE: '이용 중지',
    UNKNOWN: '확인 필요',
} as const;

/** 관리자 검수 처리 여부. API 응답 필드(`reviewStatus`)라 코드도 같이 보여줍니다. */
export const REVIEW_STATUS_LABEL = {
    PENDING: '검수 대기',
    DECIDED: '검수 완료',
} as const;

/**
 * `한글 명칭(CODE)` 로 합칩니다.
 *
 * 코드를 괄호에 남기는 이유: 관리자가 백엔드·문서와 같은 말을 쓸 수 있어야 합니다.
 * 오류 제보나 로그 대조 때 한글만 있으면 코드를 역으로 찾아야 합니다.
 */
export function withCode<T extends string>(label: Record<T, string>, code: T): string {
    return `${label[code]}(${code})`;
}
