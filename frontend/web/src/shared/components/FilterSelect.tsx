import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface FilterOption<T extends string> {
    value: T;
    label: string;
}

interface FilterSelectProps<T extends string> {
    /** 화면에 안 보이는 라벨 (스크린리더용) */
    label: string;
    value: T;
    onChange: (value: T) => void;
    options: readonly FilterOption<T>[];
    className?: string;
}

/** 검색줄에서 쓰는 드롭다운. 시안의 테두리 박스 + 오른쪽 화살표 형태입니다. */
export function FilterSelect<T extends string>({
    label,
    value,
    onChange,
    options,
    className,
}: FilterSelectProps<T>) {
    return (
        <label className="relative block">
            <span className="sr-only">{label}</span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value as T)}
                className={cn(
                    'h-[38px] appearance-none rounded-lg border border-brand-border-soft bg-white pl-[14px] pr-9 text-[12.5px] font-medium text-brand-body outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-brand-blue/40',
                    className,
                )}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            <ChevronDown
                className="pointer-events-none absolute right-[14px] top-1/2 size-4 -translate-y-1/2 text-brand-muted"
                aria-hidden
            />
        </label>
    );
}
