/**
 * 상태 코드 → 화면 표시명.
 *
 * ERD §2.4.1 이 정한 규칙입니다:
 *   "사용자 앱·키오스크·**관리자 웹**의 배지, 표, 상세 화면, 안내 문구는 한글 명칭 우선으로 표시한다."
 *   "API·DB·로그 값을 화면에 직접 노출하지 않고, **프론트엔드의 공통 상태 라벨 매핑**을 통해 변환한다."
 * `한글 명칭(CODE)` 병기는 화면이 아니라 **문서·다이어그램** 규칙입니다 (아래 `codeHint` 주석 참고).
 *
 * 아래 한글명은 **7장의 현행 "상태 표시 기준" 표**에서 그대로 가져온 값입니다. 임의로 짓지 마세요.
 * §2.4.1 안쪽 `ARCHIVED — 이전 배치 상태 매핑표 · 구현 금지` 블록의 표는 쓰지 않습니다.
 * 거기에는 `사용 가능`·`운영 가능` 처럼 현행과 다른 값과, 지금은 저장하지 않는 `RENTING`·
 * `RETURNING` 이 남아 있습니다.
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

/**
 * `STATION.device_status`
 *
 * **여기만 한글 표시를 쓰지 않습니다.** 장치 연결은 도메인 업무 상태가 아니라 통신 여부이고,
 * 표에서 한 칸을 차지하는 신호등 역할이라 짧을수록 읽힙니다. 열 제목이 이미 '온라인'이라
 * 글자가 정보를 더하지 않습니다.
 *
 * `ERROR` 는 두 글자로 접을 수 없어 `ERR` 로 둡니다. 통신이 끊긴 것과 장치가 고장 난 것은
 * 대응이 다르므로 `OFF` 와 합치지 않고, 색(빨강/주황)으로도 갈라 둡니다.
 */
export const DEVICE_STATUS_LABEL = {
    ONLINE: 'ON',
    OFFLINE: 'OFF',
    ERROR: 'ERR',
} as const;

/**
 * `SLOT.lock_status`
 *
 * ERD 표시 기준 표에서 그대로 가져왔습니다. `UNLOCKED` 의 의미가 중요합니다 —
 * "**대여·반납 처리를 위해** 잠금장치가 열린 상태", 즉 거래 중에만 잠깐 열립니다.
 * 그래서 빈 슬롯이든 우산이 든 슬롯이든 평상시 값은 `LOCKED` 입니다. 잠금장치는
 * 우산이 아니라 함 문을 잠급니다. 12-R 도 사용 가능 우산을
 * `OCCUPIED + NORMAL + AVAILABLE + LOCKED` 로 세어 `LOCKED` 를 정상 운영 상태로 씁니다.
 *
 * **`UNKNOWN` 은 ERD 표시 기준 표에 행이 없습니다.** 12-R 응답 enum
 * (`LOCKED|UNLOCKED|UNKNOWN|ERROR`)에는 있어서 화면이 받을 수 있는 값인데 한글 표시명이
 * 정해져 있지 않습니다. `occupancy_status` 의 `UNKNOWN`("점유 확인 불가")과 결을 맞춰
 * 임시로 정했고, 백엔드 담당자와 확정해야 합니다.
 */
export const LOCK_STATUS_LABEL = {
    LOCKED: '잠금',
    UNLOCKED: '잠금 해제',
    UNKNOWN: '잠금 확인 불가',
    ERROR: '잠금 오류',
} as const;

/**
 * `SLOT.occupancy_status` — **ERD v3.0 「`SLOT.occupancy_status` 표시 기준」 표 그대로입니다.**
 *
 * 물리 센서가 읽은 값이라 관리자가 직접 바꾸지 못합니다 (`ADMIN-SLOT-STATUS-001` 요청에
 * 이 축이 없는 이유). ERD 가 `UNKNOWN` 을 "센서 오류·불일치로 점유 여부를 확정할 수 없는
 * 상태"로 정의합니다 — 「비어 있음」으로 뭉개면 없는 우산을 있다고 세게 됩니다.
 */
export const OCCUPANCY_STATUS_LABEL = {
    EMPTY: '비어 있음',
    OCCUPIED: '우산 있음',
    UNKNOWN: '점유 확인 불가',
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
 * `RENTED` 는 없습니다. 관리자 API 어디에도 활성 대여 연결이 없어서, 우산이 나가 있는
 * 슬롯은 서버 기준으로도 빈 슬롯입니다 (12-R B-4).
 */
export const SLOT_DISPLAY_LABEL = {
    AVAILABLE: '이용 가능',
    EMPTY: '빈 슬롯',
    DAMAGED: '파손',
    ADMIN_REVIEW: '관리자 확인',
    OUT_OF_SERVICE: '이용 중지',
    UNKNOWN: '확인 필요',
} as const;

/** 관리자 검수 처리 여부 — `reviewStatus` */
export const REVIEW_STATUS_LABEL = {
    PENDING: '검수 대기',
    DECIDED: '검수 완료',
} as const;

/**
 * 배지·표에 찍을 글자와, 마우스오버로만 보일 코드 병기.
 *
 * **화면에는 한글만 씁니다.** ERD §2.4.1 이 대상별로 규칙을 갈라 뒀습니다.
 *   화면 — "사용자 앱·키오스크·관리자 웹의 배지, 표, 상세 화면, 안내 문구는 **한글 명칭 우선**으로 표시한다."
 *   문서 — "요구사항·정책·유저 스토리·ERD 설명과 상태 전이 서술은 **최초 등장 시** `한글 명칭(CODE)` 형식을 사용한다."
 *   다이어그램 — "Mermaid ... 사용자에게 보이는 노드·상태 라벨은 `한글 명칭(CODE)` 로 작성한다."
 * 즉 괄호 병기는 문서·다이어그램 규칙이고, 화면은 한글 우선입니다. 같은 절이
 * "**API·DB·로그 값을 화면에 직접 노출하지 않고** 프론트엔드의 공통 상태 라벨 매핑을 통해
 * 변환한다"고도 못박아서, 배지에 `(ADMIN_REVIEW)` 를 찍는 건 오히려 이 문장에 걸립니다.
 * 7장의 현행 표시 기준 표도 '표시' 열 값이 전부 한글 단독입니다.
 *
 * 다만 코드를 완전히 버리지는 않습니다. 관리자가 백엔드·로그와 대조할 때는 코드가 필요해서
 * `title`(마우스오버)에만 남깁니다. 눈에는 한글, 필요하면 코드.
 */
export function codeHint<T extends string>(label: Record<T, string>, code: T): string {
    return `${label[code]} · ${code}`;
}
