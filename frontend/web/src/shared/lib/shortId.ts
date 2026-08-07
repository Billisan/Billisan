/**
 * UUID 를 표에 넣을 수 있게 앞 8자만 남깁니다.
 *
 * ERD 의 PK 는 전부 `CHAR(36)` 이고 사람이 읽을 코드 컬럼이 없습니다. 36자를 그대로 깔면
 * 다른 열이 밀려서 줄이되, **전체 값은 화면 어딘가에서 반드시 꺼낼 수 있어야 합니다**
 * (`RefId` 가 `title`·복사 버튼으로 제공합니다).
 */
export function shortId(id: string | null | undefined): string {
    /*
     * **`null` 을 받아 냅니다.** 서버가 못 채운 식별자가 실제로 옵니다 — 검수 목록의
     * `stationId`·`slotId` 는 검수 → 반납 시도 → 슬롯 순으로 따라가 채우는 값이라,
     * 중간이 끊기면 `null` 입니다.
     *
     * 예전에는 `id: string` 이라 `null.slice()` 로 터졌고, 그게 `Array.map` 안이라
     * **한 건 때문에 목록 화면 전체가 흰 화면**이 됐습니다. 식별자 하나 못 읽은 것이
     * 화면을 죽일 이유는 없습니다.
     */
    if (!id) return '—';
    return `${id.slice(0, 8)}…`;
}
