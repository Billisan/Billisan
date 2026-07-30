import { MOCK_NS, mockUuid } from '@/features/stations/mocks/ids';
import { buildSlots } from '@/features/stations/mocks/slots';
import { MOCK_STATIONS } from '@/features/stations/mocks/stations';
import { formatSlotLabel } from '@/features/stations/types';

/**
 * 이력 목업이 쓰던 표시 코드(`R-88102`·`ST-003`·`SL-03-03`)를 **UUID** 로 바꿔 주는 변환기.
 *
 * ERD 는 모든 PK 가 `CHAR(36)` UUID 입니다. `RENTAL` 에는 `rental_request_id`(중복 요청
 * 방지용 멱등키)만 있을 뿐 사람이 읽을 코드 컬럼이 없습니다. `R-88102` 같은 형식은 근거가
 * 없어서, 서버가 붙는 순간 화면·검색·링크를 전부 다시 손봐야 합니다.
 *
 * 그래서 목업 단계에서 미리 UUID 로 맞춰 둡니다. 슬롯·검수 목업과 **같은 네임스페이스**를 써서
 * 화면끼리 ID 가 이어지고, 슬롯 상세의 '연결 반납 시도' 같은 값이 실제로 같은 대상을 가리킵니다.
 *
 * 400줄짜리 데이터를 손으로 고치지 않으려고 **코드의 숫자 부분을 그대로 seq 로 씁니다.**
 *   `R-88102`   → `e0000000-…-000000088102`
 *   `RT-88213`  → `d0000000-…-000000088213`
 *   `S-1043`    → `f0000000-…-000000001043`
 *
 * TODO: 이력 API 가 확정되면 이 파일과 목업을 함께 지우세요. ID 는 서버가 만듭니다.
 */

/** `'R-88102'` 처럼 접두사 + 숫자인 코드에서 숫자만 뽑습니다. */
function seqOf(code: string): number {
    return Number(code.replace(/\D/g, '')) || 0;
}

export function rentalUuid(code: string): string {
    return mockUuid(MOCK_NS.rental, seqOf(code));
}

export function returnUuid(code: string): string {
    return mockUuid(MOCK_NS.returnAttempt, seqOf(code));
}

export function settlementUuid(code: string): string {
    return mockUuid(MOCK_NS.settlement, seqOf(code));
}

/**
 * 대여소 이름 → 대여소 UUID.
 *
 * 예전에는 `'ST-003'` 같은 표시 코드로 찾았는데, ERD v3.0 이 `station_code` 를 P0 필수
 * 컬럼에서 뺐습니다. 목업 행에 `stationName` 이 이미 있어서 그걸로 찾습니다 — `name` 은
 * NOT NULL 이라 서버가 붙어도 늘 옵니다.
 */
export function stationUuid(name: string): string {
    const found = MOCK_STATIONS.find((station) => station.name === name);
    return (found ?? MOCK_STATIONS[0]).stationId;
}

function stationOfName(name: string) {
    return MOCK_STATIONS.find((station) => station.name === name) ?? MOCK_STATIONS[0];
}

/** `'SL-03-03'` 의 마지막 토막이 슬롯 번호입니다. */
function slotNumberOf(code: string): number {
    return Number(code.split('-').pop()) || 1;
}

/**
 * 그 대여소의 실재하는 슬롯을 고릅니다.
 *
 * 이력 목업에는 `SL-03-19` 처럼 **없는 슬롯 번호**가 섞여 있었습니다. 대여소당 슬롯은
 * 3~5개뿐이라 그런 링크는 눌러도 "존재하지 않는 슬롯" 으로 떨어집니다. 그래서 번호를 그
 * 대여소가 가진 범위 안으로 접습니다.
 */
function slotOf(stationName: string, code: string) {
    const station = stationOfName(stationName);
    const slots = buildSlots(station);
    return slots[(slotNumberOf(code) - 1 + slots.length) % slots.length];
}

export function slotUuidOf(stationName: string, code: string): string {
    return slotOf(stationName, code).slotId;
}

/** 화면 글자. 접힌 번호를 반영해야 글자와 링크 대상이 일치합니다. */
export function slotLabelOf(stationName: string, code: string): string {
    return formatSlotLabel(slotOf(stationName, code).slotNumber);
}

/**
 * `'u_8f3a'` → 사용자 UUID.
 *
 * 목업이 쓰던 `u_8f3a` 형식은 **어느 계약 문서에도 없습니다** — 12-R·ERD·화면흐름 셋 다
 * 검색해서 한 번도 안 나옵니다. 제가 지어낸 표기였습니다. 실제 값은 ERD 7장의
 * `USER_ACCOUNT.user_ref CHAR(36)` 가명 UUID 이고(학번인 `user_id CHAR(9)` 가 아닙니다),
 * "가명 식별용 불투명 참조"입니다.
 *
 * 이름도 `userRef` 가 아니라 `userRef` 입니다. 12-R 에서 `userRef` 는 딱 두 번 나오는데
 * 둘 다 "Kiosk 응답에 포함·표시하지 않는다"는 **금지 문장**이고, ERD 의 `user_ref` 는
 * PostgreSQL `FACE_PROFILE` 쪽 컬럼입니다. 관리자 화면 문서(화면흐름 §8.2·§9.2·§12)는
 * 일관되게 `userRef` 라고 씁니다.
 *
 * 화면에 그대로 다 깔지는 않습니다. 화면흐름 §12 가 "내부 식별자의 **축약 표시**" 라고
 * 정해서, 다른 ID 와 같은 `RefId`(앞 8자 + `…`)로 보여 줍니다.
 */
export function userUuid(code: string): string {
    // 'u_8f3a' 뒤 16진 4자리를 seq 로 씁니다. 같은 사람이 늘 같은 UUID 를 갖습니다.
    return mockUuid(MOCK_NS.user, parseInt(code.replace(/^u_/, ''), 16) || 0);
}
