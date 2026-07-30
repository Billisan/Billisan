/**
 * UUID 를 표에 넣을 수 있게 앞 8자만 남깁니다.
 *
 * ERD 의 PK 는 전부 `CHAR(36)` 이고 사람이 읽을 코드 컬럼이 없습니다. 36자를 그대로 깔면
 * 다른 열이 밀려서 줄이되, **전체 값은 화면 어딘가에서 반드시 꺼낼 수 있어야 합니다**
 * (`RefId` 가 `title`·복사 버튼으로 제공합니다).
 */
export function shortId(id: string): string {
    return `${id.slice(0, 8)}…`;
}
