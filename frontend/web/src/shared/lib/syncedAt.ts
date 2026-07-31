import { env } from '@/config/env';

/**
 * 화면 오른쪽 위의 「… 기준」 시각.
 *
 * 예전에는 목업 파일의 고정 문자열(`'2026-07-24 09:20'`)을 그대로 찍었습니다. 목업만
 * 돌 때는 맞는 값이었지만, **실 API 가 붙으면 방금 받은 데이터를 며칠 전 것이라고
 * 표시합니다.** 화면이 거짓말을 하는 자리라 조용히 넘어가기 나쁩니다.
 *
 * 기준으로 삼을 값이 둘입니다.
 *   서버가 준 시각 — `ADMIN-INVENTORY-001` 의 `asOf`("집계 기준 서버 시각")처럼 계약이
 *       주는 값. 있으면 이게 권위입니다. 서버가 언제 센 값인지가 화면이 언제 받았는지보다
 *       정확합니다.
 *   받은 시각     — 서버 시각이 없는 화면. TanStack Query 의 `dataUpdatedAt` 을 씁니다.
 *       "이 화면이 데이터를 손에 넣은 때"라는 뜻이고, 그 이상은 알 수 없습니다.
 *
 * 표시 형식은 기존과 같은 `YYYY-MM-DD HH:mm` 입니다.
 */

/** 두 자리로 채웁니다. `9` → `'09'` */
function pad(value: number): string {
    return String(value).padStart(2, '0');
}

/**
 * 밀리초 타임스탬프 → `YYYY-MM-DD HH:mm` (로컬 시간).
 *
 * 로컬 시간으로 찍습니다. 관리자가 보는 건 자기 시계이고, 이 값의 용도는 "얼마나
 * 오래된 화면인가"를 가늠하는 것이라 UTC 로 보여 주면 아홉 시간 어긋나 보입니다.
 */
function formatEpoch(ms: number): string {
    const at = new Date(ms);
    return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/**
 * 서버가 준 DateTime 문자열 → `YYYY-MM-DD HH:mm`.
 *
 * **`Date` 로 파싱하지 않고 잘라 씁니다.** 서버 값은 `DATETIME(6)` 마이크로초 원문이거나
 * ISO 문자열인데, 파싱했다가 다시 만들면 시간대 해석이 끼어들어 하루가 밀리거나
 * 자릿수가 잘립니다(`formatUpdatedAt` 이 같은 이유로 자르기만 합니다).
 *
 * 다만 `Z` 로 끝나는 UTC 표기는 잘라 쓰면 아홉 시간 어긋나 보이므로 그때만 파싱합니다.
 */
export function formatServerTime(value: string): string {
    if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) {
        const ms = Date.parse(value);
        if (!Number.isNaN(ms)) return formatEpoch(ms);
    }
    return `${value.slice(0, 10)} ${value.slice(11, 16)}`;
}

/**
 * 「… 기준」 문구를 만듭니다.
 *
 * @param serverTime   그 데이터의 기준 시각. 계약이 주는 값(`asOf`)이거나, 목업 모드에서는
 *                     목업이 만들어진 시각입니다. 있으면 이게 권위입니다.
 * @param fetchedAt    `query.dataUpdatedAt` (밀리초). 서버 시각이 없을 때의 차선책입니다.
 *
 * 둘 다 없으면 빈 문자열입니다 — 아직 아무것도 못 받은 상태에서 시각을 지어내면
 * 안 됩니다. `PageBar` 는 빈 `meta` 를 그리지 않습니다.
 *
 * **목업 모드에서 조회 시각을 쓰면 안 됩니다.** 목업 데이터는 07-24 로 고정돼 있는데
 * 오늘 날짜를 찍으면 화면이 거짓말을 합니다. 반대로 실 API 에서 목업 상수를 쓰면 방금
 * 받은 데이터를 며칠 전 것이라고 합니다. 그래서 부르는 쪽이 모드에 맞는 값을 넘깁니다
 * (`mockSyncedAt` 헬퍼 참고).
 */
export function syncedAtLabel(
    serverTime: string | undefined,
    fetchedAt: number | undefined,
): string {
    if (serverTime) return `${formatServerTime(serverTime)} 기준`;
    if (fetchedAt) return `${formatEpoch(fetchedAt)} 기준`;
    return '';
}

/**
 * 목업 모드일 때만 목업 기준 시각을 돌려줍니다.
 *
 * 목업이 아니면 `undefined` 라 `syncedAtLabel` 이 조회 시각으로 넘어갑니다. 화면마다
 * `env.useMockData` 를 직접 보면 조건을 빠뜨리는 곳이 생기므로 한 줄로 모아 둡니다.
 *
 * TODO: 각 API 가 계약에서 기준 시각을 주기 시작하면(`ADMIN-INVENTORY-001` 의 `asOf`
 * 처럼) 이 헬퍼 대신 그 값을 넘기세요.
 */
export function mockSyncedAt(value: string): string | undefined {
    return env.useMockData ? value : undefined;
}
