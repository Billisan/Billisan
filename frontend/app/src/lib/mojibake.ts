// 임시 우회 — Spring 응답의 displayName이 서버 쪽 인코딩 버그로 깨져서 온다(2026-08-06 확인,
// PROGRESS.md 참고). 원본 UTF-8 바이트가 Windows-1252로 한 번 잘못 디코딩된 뒤 다시 UTF-8로
// 인코딩돼 전달되는 것으로 보여 그 과정을 역으로 되돌린다.
//
// 완벽한 복원은 아니다 — 이 과정에서 이미 유실된 바이트가 있으면 그 글자는 대체 문자(�)로 남는다.
// 백엔드와 협의해 원인(DB 커넥션 charset 또는 Spring 직렬화 설정)을 고친 뒤에는 이 파일과
// 호출부(authApi.ts/homeApi.ts/userApi.ts)를 제거할 것.
const CP1252_TO_CODEPOINT: Record<number, number> = {
  0x80: 0x20ac,
  0x82: 0x201a,
  0x83: 0x0192,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02c6,
  0x89: 0x2030,
  0x8a: 0x0160,
  0x8b: 0x2039,
  0x8c: 0x0152,
  0x8e: 0x017d,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02dc,
  0x99: 0x2122,
  0x9a: 0x0161,
  0x9b: 0x203a,
  0x9c: 0x0153,
  0x9e: 0x017e,
  0x9f: 0x0178,
}

const CODEPOINT_TO_CP1252: Record<number, number> = Object.fromEntries(
  Object.entries(CP1252_TO_CODEPOINT).map(([byte, codepoint]) => [codepoint, Number(byte)]),
)

export function decodeMojibakeDisplayName(name: string): string {
  const bytes = Uint8Array.from(name, (ch) => {
    const codepoint = ch.codePointAt(0) ?? 0
    return CODEPOINT_TO_CP1252[codepoint] ?? (codepoint <= 0xff ? codepoint : 0x3f)
  })
  return new TextDecoder('utf-8').decode(bytes)
}
