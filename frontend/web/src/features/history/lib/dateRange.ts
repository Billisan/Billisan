import type { FilterOption } from '@/shared/components/FilterSelect';

/**
 * 이력 화면의 조회 기간.
 *
 * **예전 드롭다운은 아무 일도 하지 않았습니다.** `기간: 07.01 ~ 07.24` 같은 값이 URL 에는
 * 쓰였지만 목록 필터가 그 값을 읽지 않아서, 무엇을 골라도 결과가 같았습니다. 게다가
 * 첫 항목 라벨에 날짜가 박혀 있어 기준일이 바뀌면 거짓말이 됩니다.
 *
 * 이제 프리셋 셋(일주일·한 달·세 달)과 사용자 지정을 두고, 고른 값이 실제 조회 범위가
 * 됩니다. 사용자 지정을 고르면 시작일·종료일 달력이 옆에 붙습니다.
 *
 * 기준 시각을 인자로 받습니다 — 목업이 2026-07-24 기준이라 `new Date()` 를 쓰면 전부
 * 범위 밖으로 떨어집니다. 서버가 붙으면 응답의 `asOf` 를 넘기세요.
 */

/** URL 에 들어가는 값. 날짜를 직접 넣지 않아 주소가 짧고, 프리셋은 기준일 따라 움직입니다. */
export type PeriodPreset = '7D' | '1M' | '3M' | 'CUSTOM';

export const PERIOD_OPTIONS: readonly FilterOption<PeriodPreset>[] = [
    { value: '7D', label: '최근 일주일' },
    { value: '1M', label: '최근 한 달' },
    { value: '3M', label: '최근 세 달' },
    { value: 'CUSTOM', label: '사용자 지정' },
];

/** 기본값. 이력이 30일 집계 기준이라 한 달로 둡니다. */
export const DEFAULT_PERIOD: PeriodPreset = '1M';

export function parsePeriod(value: string | null): PeriodPreset {
    return PERIOD_OPTIONS.some((option) => option.value === value)
        ? (value as PeriodPreset)
        : DEFAULT_PERIOD;
}

/** `'2026-07-24 09:20'` · `'2026-07-24'` 어느 쪽이든 앞 10자가 날짜입니다. */
function dayOf(value: string): string {
    return value.slice(0, 10);
}

/** 기준일에서 며칠 뺀 날. 문자열로만 다뤄 타임존이 끼어들지 않습니다. */
function minusDays(baseDay: string, days: number): string {
    const [y, m, d] = baseDay.split('-').map(Number);
    const shifted = new Date(Date.UTC(y, m - 1, d - days));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export interface DateRange {
    /** 포함 시작일 `YYYY-MM-DD` */
    from: string;
    /** 포함 종료일 `YYYY-MM-DD` */
    to: string;
}

/**
 * 프리셋·사용자 지정을 실제 날짜 범위로 바꿉니다.
 *
 * 사용자 지정인데 값이 비어 있으면 한 달로 되돌립니다 — 빈 범위로 목록을 0건으로 만들면
 * 관리자는 데이터가 없어졌다고 읽습니다.
 */
export function resolveRange(
    period: PeriodPreset,
    asOf: string,
    custom?: Partial<DateRange>,
): DateRange {
    const today = dayOf(asOf);

    if (period === 'CUSTOM' && custom?.from && custom?.to) {
        // 거꾸로 넣어도 동작하게 정렬합니다.
        return custom.from <= custom.to
            ? { from: custom.from, to: custom.to }
            : { from: custom.to, to: custom.from };
    }

    const days = period === '7D' ? 7 : period === '3M' ? 90 : 30;
    // 오늘을 포함해 N일이라 하루를 뺍니다.
    return { from: minusDays(today, days - 1), to: today };
}

/** 그 시각이 범위 안인지. 시각 문자열의 앞 10자만 봅니다. */
export function withinRange(at: string, range: DateRange): boolean {
    const day = dayOf(at);
    return day >= range.from && day <= range.to;
}
