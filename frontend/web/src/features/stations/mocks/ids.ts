/**
 * 목업용 고정 UUID 생성기.
 *
 * ERD 의 PK 는 전부 `CHAR(36)` UUID 입니다 (`station_id`, `slot_id`, `inspection_id` …).
 * 목업이 'ST-003' 같은 코드를 신원으로 쓰면, 연동할 때 라우트·쿼리키·API 호출을 전부
 * 다시 손봐야 합니다. 그래서 지금부터 신원은 UUID 로 두고 코드·번호는 표시용으로만 씁니다.
 *
 * 값은 고정입니다 — 새로고침해도 같은 슬롯이 같은 ID 를 갖습니다.
 * TODO: 실 API 연동 시 이 파일을 지우세요. ID 는 서버가 만듭니다.
 */

/** 종류별 네임스페이스. 앞 8자리만 보면 무슨 엔터티인지 알 수 있게 해 둡니다. */
export const MOCK_NS = {
    station: 'a0000000',
    slot: 'b0000000',
    inspection: 'c0000000',
    returnAttempt: 'd0000000',
    rental: 'e0000000',
} as const;

/** UUID v4 모양(`8-4-4-4-12`)을 지키는 합성 ID. 진짜 무작위는 아닙니다. */
export function mockUuid(namespace: string, seq: number): string {
    return `${namespace}-0000-4000-8000-${String(seq).padStart(12, '0')}`;
}
