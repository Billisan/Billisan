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

/** `'ST-003'` → 대여소 UUID. 없는 코드면 첫 대여소로 떨어집니다. */
export function stationUuid(code: string): string {
    const found = MOCK_STATIONS.find((station) => station.stationCode === code);
    return (found ?? MOCK_STATIONS[0]).stationId;
}

/**
 * 슬롯 라벨의 가운데 두 자리 → 대여소.
 *
 * `formatSlotLabel` 이 `stationCode` 의 **뒤 두 자리**로 라벨을 만듭니다 (`ST-003` → `SL-03-…`).
 * 그래서 `ST-${두자리}` 로 찾으면 못 찾고 첫 대여소로 떨어집니다 — 화면 글자는 '제1공학관'인데
 * 링크는 '정문 광장' 으로 가는 사고가 여기서 났습니다. 같은 규칙으로 되짚습니다.
 */
function stationOfLabel(twoDigits: string) {
    const found = MOCK_STATIONS.find(
        (item) => item.stationCode.replace(/\D/g, '').slice(-2).padStart(2, '0') === twoDigits,
    );
    return found ?? MOCK_STATIONS[0];
}

/**
 * `'SL-03-03'` → 그 대여소의 실제 슬롯 UUID.
 *
 * 이력 목업에는 `SL-03-19` 처럼 **실제로 없는 슬롯 번호**가 섞여 있었습니다. 대여소당 슬롯은
 * 3~5개뿐이라 그런 링크는 눌러도 "존재하지 않는 슬롯"으로 떨어집니다. 그래서 번호를 그
 * 대여소가 가진 범위 안으로 접어서 항상 실재하는 슬롯을 가리키게 합니다.
 */
export function slotUuidOf(code: string): string {
    const [, stationPart, slotPart] = code.split('-');
    const station = stationOfLabel(stationPart);
    const slots = buildSlots(station);
    const index = (Number(slotPart) - 1 + slots.length) % slots.length;

    return slots[index].slotId;
}

/** 위 슬롯의 표시 라벨. 접힌 번호를 반영해야 화면 글자와 링크 대상이 일치합니다. */
export function slotLabelOf(code: string): string {
    const [, stationPart, slotPart] = code.split('-');
    const station = stationOfLabel(stationPart);
    const slots = buildSlots(station);
    const index = (Number(slotPart) - 1 + slots.length) % slots.length;

    return formatSlotLabel(station.stationCode, slots[index].slotNumber);
}
