import { FilterSelect } from '@/shared/components/FilterSelect';
import {
    PERIOD_OPTIONS,
    type DateRange,
    type PeriodPreset,
} from '@/features/history/lib/dateRange';

/**
 * 이력 화면의 조회 기간 컨트롤.
 *
 * 날짜 계산은 `lib/dateRange.ts` 가 맡습니다. 이 파일은 화면만 그립니다 — 순수 함수를
 * 컴포넌트 파일에서 함께 내보내면 개발 중 Fast Refresh 가 깨집니다.
 */
interface DateRangeFilterProps {
    period: PeriodPreset;
    onPeriodChange: (value: PeriodPreset) => void;
    range: DateRange;
    /** 사용자 지정 날짜를 바꿨을 때. 프리셋일 때는 호출되지 않습니다. */
    onCustomChange: (next: DateRange) => void;
    /** 달력이 미래를 못 고르게 막는 기준일 */
    maxDay: string;
}

export function DateRangeFilter({
    period,
    onPeriodChange,
    range,
    onCustomChange,
    maxDay,
}: DateRangeFilterProps) {
    const dateClass =
        'h-[38px] rounded-lg bg-brand-surface px-[12px] text-[12.5px] font-medium text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40';

    return (
        <>
            <FilterSelect
                label="조회 기간"
                value={period}
                onChange={onPeriodChange}
                options={PERIOD_OPTIONS}
                className="w-[150px]"
            />

            {/*
             * 사용자 지정일 때만 달력이 나옵니다. 늘 띄워 두면 조회줄이 길어지고,
             * 프리셋을 고른 상태에서 날짜칸을 만지면 어느 쪽이 이기는지 헷갈립니다.
             *
             * `<input type="date">` 를 씁니다. 직접 만든 달력보다 접근성·키보드·모바일
             * 동작이 낫고, 이 화면에 필요한 건 날짜 하나 고르기뿐입니다.
             */}
            {period === 'CUSTOM' && (
                <span className="flex items-center gap-[6px]">
                    <input
                        type="date"
                        aria-label="조회 시작일"
                        value={range.from}
                        max={range.to || maxDay}
                        onChange={(event) => onCustomChange({ ...range, from: event.target.value })}
                        className={dateClass}
                    />
                    <span className="text-[12px] text-brand-muted" aria-hidden>
                        ~
                    </span>
                    <input
                        type="date"
                        aria-label="조회 종료일"
                        value={range.to}
                        min={range.from}
                        max={maxDay}
                        onChange={(event) => onCustomChange({ ...range, to: event.target.value })}
                        className={dateClass}
                    />
                </span>
            )}
        </>
    );
}
