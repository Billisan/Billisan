import { Fragment } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';

export interface Crumb {
    label: string;
    /** 없으면 현재 위치로 보고 링크를 걸지 않습니다. */
    to?: string;
}

interface PageBarProps {
    breadcrumb?: Crumb[];
    /** 우측 정렬 보조 문구 (예: '최근 통신 2026-07-24 09:19') */
    meta?: string;
    className?: string;
}

/**
 * 콘텐츠 영역 최상단의 경로 + 갱신시각 줄.
 *
 * 시안에서 이 줄은 본문 기본 여백(main 의 pt-8)보다 헤더 쪽에 붙어 있습니다.
 * 그만큼 위로 당기고, 아래 여백을 늘려 본문 시작 위치는 그대로 둡니다.
 */
export function PageBar({ breadcrumb, meta, className }: PageBarProps) {
    return (
        <div
            className={cn(
                '-mt-[13px] mb-[33px] flex h-4 items-center justify-between gap-4',
                className,
            )}
        >
            {breadcrumb?.length ? (
                <nav
                    className="flex min-w-0 items-center text-[11.5px] font-medium text-brand-muted"
                    aria-label="현재 위치"
                >
                    {breadcrumb.map((crumb, index) => (
                        <Fragment key={`${crumb.label}-${index}`}>
                            {/* 시안은 아이콘이 아니라 글자 '›' 입니다. 아이콘을 쓰면 여백이 더 벌어져요. */}
                            {index > 0 && (
                                <span className="mx-[7px] shrink-0" aria-hidden>
                                    ›
                                </span>
                            )}
                            {crumb.to ? (
                                <Link
                                    to={crumb.to}
                                    className="shrink-0 transition-colors hover:text-brand-body"
                                >
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span className="truncate" aria-current="page">
                                    {crumb.label}
                                </span>
                            )}
                        </Fragment>
                    ))}
                </nav>
            ) : (
                <span />
            )}

            {meta && (
                <span className="shrink-0 text-[11.5px] font-medium text-brand-muted-strong">
                    {meta}
                </span>
            )}
        </div>
    );
}
