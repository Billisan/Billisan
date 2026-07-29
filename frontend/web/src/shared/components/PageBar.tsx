import { ArrowLeft } from 'lucide-react';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { useGoBack } from '@/shared/hooks/useGoBack';

export interface Crumb {
    label: string;
    /** 없으면 현재 위치로 보고 링크를 걸지 않습니다. */
    to?: string;
}

interface PageBarProps {
    breadcrumb?: Crumb[];
    /** 우측 정렬 보조 문구 (예: '최근 통신 2026-07-24 09:19') */
    meta?: string;
    /**
     * 밖에서 바로 들어왔을 때 '뒤로' 가 보낼 자리.
     * 기본값은 빵부스러기에서 링크가 걸린 마지막 항목입니다. 링크가 하나도 없는 화면
     * (상위 목록이 아예 없는 사용자 이력 같은)만 직접 지정하면 됩니다.
     */
    backTo?: string;
    className?: string;
}

/**
 * 콘텐츠 영역 최상단의 경로 + 갱신시각 줄.
 *
 * 시안에서 이 줄은 본문 기본 여백(main 의 pt-8)보다 헤더 쪽에 붙어 있습니다.
 * 그만큼 위로 당기고, 아래 여백을 늘려 본문 시작 위치는 그대로 둡니다.
 *
 * **'뒤로' 버튼은 빵부스러기가 있는 화면에만 붙습니다.** 사이드바로 바로 가는 첫 화면
 * (대시보드·대여소 관리·우산 재고·이력·파손 검수)은 빵부스러기를 두지 않으므로 자동으로
 * 제외됩니다. 화면마다 버튼을 따로 달면 언젠가 하나를 빠뜨리는데, 조건을 여기 한 줄로
 * 묶어 두면 그럴 일이 없습니다.
 */
export function PageBar({ breadcrumb, meta, backTo, className }: PageBarProps) {
    // 링크가 걸린 마지막 항목이 곧 상위 화면입니다. 마지막 항목은 현재 위치라 링크가 없습니다.
    const parent = backTo ?? [...(breadcrumb ?? [])].reverse().find((crumb) => crumb.to)?.to;
    const goBack = useGoBack(parent ?? '/');

    return (
        <div
            className={cn(
                // 버튼이 들어가며 줄이 12px 두꺼워졌습니다. 위아래 여백에서 6px 씩 걷어내
                // 글자 중심선과 본문 시작 위치는 원래 자리에 그대로 둡니다.
                '-mt-[19px] mb-[27px] flex h-7 items-center justify-between gap-4',
                className,
            )}
        >
            {breadcrumb?.length ? (
                <nav
                    className="flex min-w-0 items-center text-[11.5px] font-medium text-brand-muted"
                    aria-label="현재 위치"
                >
                    {parent && (
                        <button
                            type="button"
                            onClick={goBack}
                            className="mr-[13px] inline-flex h-7 shrink-0 items-center gap-[5px] rounded-[7px] border border-brand-border-soft bg-white pl-[8px] pr-[11px] text-[11.5px] font-bold text-brand-body transition-colors hover:bg-brand-surface"
                        >
                            <ArrowLeft className="size-[13px]" strokeWidth={2.4} aria-hidden />
                            뒤로
                        </button>
                    )}

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
