import type { MouseEvent, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** 행 왼쪽에 세로 강조 바를 붙일 때 쓰는 톤 */
export type RowAccent = 'red' | 'amber';

const ACCENT_CLASS: Record<RowAccent, string> = {
    red: 'bg-tone-red-fg',
    amber: 'bg-tone-amber-fg',
};

export function TableCard({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('overflow-hidden rounded-lg bg-white', className)}>{children}</div>;
}

export function DataTable({ children }: { children: ReactNode }) {
    return <table className="w-full table-fixed border-collapse">{children}</table>;
}

/**
 * 표 양 끝의 14px 스페이서 열.
 * 행 구분선을 카드 안쪽으로 들여쓰기 위해 둡니다(시안: 카드 288~1244, 구분선 302~1230).
 */
function SpacerCell({ accent }: { accent?: RowAccent }) {
    return (
        <td className="relative w-[14px]">
            {accent && (
                <span
                    className={cn(
                        'absolute left-[2px] top-1/2 h-[39px] w-[3px] -translate-y-1/2 rounded-full',
                        ACCENT_CLASS[accent],
                    )}
                    aria-hidden
                />
            )}
        </td>
    );
}

export function THead({ children }: { children: ReactNode }) {
    return (
        <thead className="bg-brand-surface">
            <tr className="h-[42px]">
                <th className="w-[14px]" />
                {children}
                <th className="w-[14px]" />
            </tr>
        </thead>
    );
}

type Align = 'left' | 'center' | 'right';

const ALIGN_CLASS: Record<Align, string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
};

export function Th({
    children,
    align = 'left',
    className,
}: {
    children?: ReactNode;
    align?: Align;
    className?: string;
}) {
    return (
        <th
            scope="col"
            className={cn(
                'text-[11.5px] font-bold leading-none text-brand-body',
                ALIGN_CLASS[align],
                className,
            )}
        >
            {children}
        </th>
    );
}

export function TBody({ children }: { children: ReactNode }) {
    return <tbody className="[&>tr:last-child>td]:border-b-0">{children}</tbody>;
}

/**
 * 행 높이는 화면마다 달라서(대여소 53px, 슬롯 47.75px) className 으로 덮어씁니다.
 *
 * onClick 을 주면 행 전체가 눌립니다. 다만 이건 마우스 편의일 뿐이라
 * 키보드·스크린리더용 링크는 행 안에 그대로 두어야 합니다. tr 자체를 탭 대상으로
 * 만들면 같은 목적지가 두 번 잡혀서 오히려 이동이 번거로워집니다.
 */
export function Tr({
    children,
    accent,
    className,
    onClick,
}: {
    children: ReactNode;
    accent?: RowAccent;
    className?: string;
    onClick?: () => void;
}) {
    const handleClick = onClick
        ? (event: MouseEvent<HTMLTableRowElement>) => {
              // 행 안의 링크·버튼은 자기 동작을 그대로 합니다.
              if ((event.target as HTMLElement).closest('a,button,input,select')) return;
              // 텍스트를 드래그해 고른 것뿐이면 이동하지 않습니다.
              if (window.getSelection()?.toString()) return;
              onClick();
          }
        : undefined;

    return (
        <tr
            className={cn(
                'h-[53px]',
                onClick && 'cursor-pointer transition-colors hover:bg-brand-surface',
                className,
            )}
            onClick={handleClick}
        >
            <SpacerCell accent={accent} />
            {children}
            <SpacerCell />
        </tr>
    );
}

export function Td({
    children,
    align = 'left',
    className,
}: {
    children?: ReactNode;
    align?: Align;
    className?: string;
}) {
    return (
        <td
            className={cn(
                'border-b border-brand-line-soft text-[12.5px] text-brand-ink-soft',
                ALIGN_CLASS[align],
                className,
            )}
        >
            {children}
        </td>
    );
}
