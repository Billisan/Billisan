/**
 * 서버 시각 문자열 → 화면 표시.
 *
 * **`Date` 로 파싱하지 않고 자릅니다.** 서버 값은 `DATETIME(6)`(`2026-08-01T08:52:00.000000+09:00`)
 * 인데, 파싱했다 다시 만들면 시간대 해석이 끼어들어 날짜가 밀리거나 마이크로초가 잘립니다.
 * 표시에 필요한 건 앞자리뿐이라 자르는 편이 안전합니다.
 *
 * 두 입력 형식을 모두 견딥니다 — 11번째 글자가 `T` 든 공백이든 자리는 같습니다.
 * ```
 * 2026-08-01T08:52:00.000000+09:00
 * 2026-08-01 08:52
 * ─────────┴┴────
 * 0        10 11..16
 * ```
 *
 * 예전에는 화면마다 `value.slice(5)` · `value.slice(11)` 을 직접 썼습니다. 목업이 표시
 * 형식(`'2026-07-23 18:05'`)을 들고 있을 때는 맞았지만, 목업을 EC2 시드에 맞추면서 값이
 * 서버 형식이 되자 표에 `08-01T08:52:00.000000+09:00` 이 그대로 찍혔습니다.
 */

/** `YYYY-MM-DD HH:mm` — 상세 화면의 정보 행처럼 날짜까지 필요한 자리. */
export function formatDateTime(value: string): string {
    return `${value.slice(0, 10)} ${value.slice(11, 16)}`;
}

/** `MM-DD HH:mm` — 목록 표. 연도는 열 너비만 잡아먹어 뺍니다. */
export function formatDayTime(value: string): string {
    return `${value.slice(5, 10)} ${value.slice(11, 16)}`;
}

/** `HH:mm` — 같은 날 안의 진행 단계를 늘어놓는 타임라인. */
export function formatTimeOnly(value: string): string {
    return value.slice(11, 16);
}

/** `YYYY-MM-DD` — 날짜만 비교하거나 표시할 때. */
export function dayOf(value: string): string {
    return value.slice(0, 10);
}

/** KST 오프셋. 한국은 서머타임이 없어 연중 고정입니다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 오늘 날짜(`YYYY-MM-DD`) — **KST 기준**입니다.
 *
 * 서버 시각이 KST 라서 기준일도 KST 여야 합니다. `BILL-154` 가 MySQL 세션
 * 시간대를 `+09:00` 으로 고정하면서 확정됐습니다(`--default-time-zone=+09:00`,
 * `SET time_zone = '+09:00'`). 그전에는 "서버가 UTC 로 기록한다"는 관측을 근거로
 * 기간 필터가 `new Date().toISOString()`(UTC 날짜)을 썼는데, 이제 근거가 뒤집혔습니다.
 *
 * **UTC 날짜를 쓰면 00:00~09:00 KST 사이에 하루가 밀립니다.** 그 시간대의 UTC 날짜는
 * 아직 전날이라, 「최근 7일」이 8일치를 잡습니다.
 *
 * `getFullYear()` 같은 로컬 시각 API 를 쓰지 않습니다 — 그러면 PC 시간대 설정에
 * 결과가 딸려갑니다. 여기서 필요한 건 "KST 로 오늘이 며칠인가" 하나라, UTC 에
 * 9시간을 더한 뒤 UTC 필드를 읽어 기계 설정과 무관하게 만듭니다.
 */
export function todayInKst(now: number = Date.now()): string {
    return new Date(now + KST_OFFSET_MS).toISOString().slice(0, 10);
}
