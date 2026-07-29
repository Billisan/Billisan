/**
 * 요청 추적 ID.
 *
 * API명세가 관리자 API 헤더에 `X-Request-Id: <UUID>` 를 요구합니다 (B-3.1 · B-4.3).
 * 오류 응답의 `meta.requestId` 와 짝지어 서버 로그를 찾는 값이라, 요청마다 새로 만듭니다.
 */
export function newRequestId(): string {
    // crypto.randomUUID 는 보안 컨텍스트(https·localhost)에서만 있습니다.
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // LAN IP 로 열어 둔 개발 서버처럼 보안 컨텍스트가 아닌 경우의 대체 경로.
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    }

    // RFC 4122 v4 자리 맞추기
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
