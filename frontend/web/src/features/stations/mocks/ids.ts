/**
 * 목업용 고정 UUID 생성기.
 *
 * ERD 의 PK 는 전부 `CHAR(36)` UUID 입니다. 목업이 'ST-003' 같은 코드를 신원으로 쓰면
 * 라우트·쿼리키·API 호출이 실 API 와 어긋나므로, 목업도 UUID 를 신원으로 씁니다.
 *
 * 값은 고정입니다 — 새로고침해도 같은 대여소가 같은 ID 를 갖습니다.
 *
 * **실 시드 대여소(`ec2Seed.ts`)에는 쓰지 않습니다.** 그쪽은 서버에 실재하는 UUID 를
 * 그대로 적습니다. 이 파일은 화면을 채우려고 덧붙인 가상 대여소 전용입니다.
 */

/**
 * 종류별 씨앗값.
 *
 * **앞자리로 종류를 알아보라고 두는 값이 아닙니다.** 실제 UUID 에는 종류를 알려 주는
 * 규칙이 없습니다. 목업만 `e0000000…` 처럼 규칙 있는 모양을 쓰면 그 모양에 눈이 익어
 * 버리고, 실 API 로 갈아타는 날 화면·검증 스크립트가 한꺼번에 어긋납니다.
 *
 * 그래서 이 문자열은 **해시 씨앗**으로만 씁니다. 종류가 다르면 같은 seq 라도 다른 UUID 가
 * 나오게 하는 역할입니다.
 */
export const MOCK_NS = {
    station: 'station',
    slot: 'slot',
    inspection: 'inspection',
} as const;

/**
 * 목업 전용 안정 시드. 같은 문자열이면 늘 같은 작은 수를 냅니다.
 *
 * **UUID 를 파싱해서 쓰지 마세요.** 예전에 `Number(stationId.slice(-4))` 로 꼬리 숫자를
 * 읽었는데, 실제 UUID 는 전 구간이 무작위라 `NaN` 으로 떨어져 모든 대여소가 같은 시드로
 * 뭉갰습니다. 해시는 값의 의미를 뽑는 게 아니라 흩뿌리는 것이라 그 함정이 없습니다.
 */
export function mockSeq(input: string): number {
    // 1..9999 로 좁힙니다. 슬롯 시드(seq*100+번호)가 너무 커지지 않게요.
    return (hash32(input, 0) % 9999) + 1;
}

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
 * 진짜 난수는 아닙니다. `(종류, seq)` 를 해시해서 만들기 때문에 새로고침해도, 다시
 * 빌드해도 같은 대상은 같은 ID 를 갖습니다. 그러면서 32자 전 구간이 흩어져 있어 실제
 * 서버가 줄 값과 모양이 같습니다 — 앞 8자만 축약해 보여 줘도 서로 구분됩니다.
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
