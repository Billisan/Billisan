import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type BadgeTone = 'green' | 'blue' | 'amber' | 'red' | 'slate' | 'violet';

/** 톤별 배경/글자색. 문자열 리터럴이어야 Tailwind JIT 가 클래스를 뽑아냅니다. */
const TONE_CLASS: Record<BadgeTone, string> = {
    green: 'bg-tone-green-bg text-tone-green-fg',
    blue: 'bg-tone-blue-bg text-tone-blue-fg',
    amber: 'bg-tone-amber-bg text-tone-amber-fg',
    red: 'bg-tone-red-bg text-tone-red-fg',
    slate: 'bg-tone-slate-bg text-tone-slate-fg',
    violet: 'bg-tone-violet-bg text-tone-violet-fg',
};

interface BadgeProps {
    tone: BadgeTone;
    children: ReactNode;
    className?: string;
    /** 줄임 표기(`ON`·`ERR` 등)를 쓸 때 원래 뜻을 마우스오버로 남깁니다. */
    title?: string;
}

/** 표 안에서 상태를 표시하는 알약형 배지 (높이 22px 고정). */
export function Badge({ tone, children, className, title }: BadgeProps) {
    return (
        <span
            title={title}
            className={cn(
                'inline-flex h-[22px] shrink-0 items-center justify-center rounded-md px-[10px] text-[11px] font-bold leading-none',
                TONE_CLASS[tone],
                className,
            )}
        >
            {children}
        </span>
    );
}
