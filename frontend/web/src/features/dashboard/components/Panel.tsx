import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface PanelProps {
    children: ReactNode;
    className?: string;
}

/**
 * 대시보드 카드 껍데기.
 * 시안의 카드는 테두리·그림자 없이 흰 배경 + radius 8 만 씁니다.
 */
export function Panel({ children, className }: PanelProps) {
    return (
        <section className={cn('flex flex-col rounded-lg bg-white', className)}>{children}</section>
    );
}

interface PanelHeaderProps {
    title: string;
    /** 우측 보조 문구 */
    meta?: string;
    className?: string;
    /** 보조 문구 크기가 카드마다 달라서 열어둔 훅 */
    metaClassName?: string;
}

export function PanelHeader({ title, meta, className, metaClassName }: PanelHeaderProps) {
    return (
        <div className={cn('flex shrink-0 items-baseline justify-between gap-3', className)}>
            {/* leading 을 고정해야 시안의 카드 내부 여백(제목~구분선 46px)이 맞습니다 */}
            <h2 className="text-[14.5px] font-extrabold leading-[18px] text-brand-ink">{title}</h2>
            {meta && (
                <span
                    className={cn(
                        'shrink-0 font-medium text-brand-muted',
                        metaClassName ?? 'text-[11.5px]',
                    )}
                >
                    {meta}
                </span>
            )}
        </div>
    );
}
