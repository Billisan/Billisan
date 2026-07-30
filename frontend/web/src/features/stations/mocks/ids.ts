/**
 * 목업용 고정 UUID 생성기.
 *
 * ERD 의 PK 는 전부 `CHAR(36)` UUID 입니다 — `user_id`, `rental_id`, `return_attempt_id`,
 * `settlement_id`, `station_id`, `slot_id`, `inspection_id` 일곱 개 모두 예외가 없습니다.
 * 목업이 'ST-003' 같은 코드를 신원으로 쓰면, 연동할 때 라우트·쿼리키·API 호출을 전부
 * 다시 손봐야 합니다. 그래서 지금부터 신원은 UUID 로 두고 코드·번호는 표시용으로만 씁니다.
 *
 * 값은 고정입니다 — 새로고침해도 같은 슬롯이 같은 ID 를 갖습니다.
 * TODO: 실 API 연동 시 이 파일을 지우세요. ID 는 서버가 만듭니다.
 */

/**
 * 종류별 씨앗값.
 *
 * **앞자리로 종류를 알아보라고 두는 값이 아닙니다.** ERD 는 이 값들이 "Spring 이 생성한
 * 무작위 UUID" 라고 못 박았고, 실제 값에는 종류를 알려 주는 규칙이 없습니다. 목업만
 * `e0000000…` 처럼 규칙 있는 모양을 쓰면 그 모양에 눈이 익어 버리고, 연동하는 날
 * 화면·검증 스크립트가 한꺼번에 어긋납니다. 화면에서 뭐가 뭔지는 열 제목과 라벨이
 * 이미 알려 주므로 앞자리에 의미를 실을 이유도 없습니다.
 *
 * 그래서 이 문자열은 **해시 씨앗**으로만 씁니다. 종류가 다르면 같은 seq 라도 다른 UUID 가
 * 나오게 하는 역할입니다.
 */
export const MOCK_NS = {
    station: 'station',
    slot: 'slot',
    inspection: 'inspection',
    returnAttempt: 'return-attempt',
    rental: 'rental',
    settlement: 'settlement',
    /** `USER_ACCOUNT.user_ref` (ERD v3.0 §7.1). 학번에서 유도하지 않는 가명 UUID 입니다. */
    user: 'user',
} as const;

/** FNV-1a 32비트. 암호용이 아니라 "같은 입력이면 같은 값" 만 보장하면 되는 자리입니다. */
function hash32(input: string, salt: number): number {
    let hash = 0x811c9dc5 ^ salt;

    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        // Math.imul 이라야 32비트 곱셈이 넘치지 않고 잘립니다.
        hash = Math.imul(hash, 0x01000193);
    }

    return hash >>> 0;
}

/**
 * UUID v4 모양(`8-4-4-4-12`)의 **무작위처럼 보이는** 고정 ID.
 *
 * 진짜 난수는 아닙니다. `(종류, seq)` 를 해시해서 만들기 때문에 새로고침해도, 다시 빌드해도
 * 같은 대상은 같은 ID 를 갖습니다. 그러면서 32자 전 구간이 흩어져 있어 실제 서버가 줄 값과
 * 모양이 같습니다 — 앞 8자만 축약해 보여 줘도(화면흐름 §12) 서로 구분됩니다.
 *
 * 버전 자리(13번째)는 `4`, variant 자리(17번째)는 `8~b` 로 고정해 UUID v4 규격을 지킵니다.
 */
export function mockUuid(namespace: string, seq: number): string {
    const seed = `${namespace}:${seq}`;
    const hex = [0, 1, 2, 3]
        .map((salt) => hash32(seed, salt).toString(16).padStart(8, '0'))
        .join('');

    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        `4${hex.slice(13, 16)}`,
        `${'89ab'[parseInt(hex[16], 16) % 4]}${hex.slice(17, 20)}`,
        hex.slice(20, 32),
    ].join('-');
}
