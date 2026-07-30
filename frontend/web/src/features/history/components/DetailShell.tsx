import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

import { Badge, type BadgeTone } from '@/shared/components/Badge';
import { cn } from '@/lib/utils';
import { PageTitle } from '@/shared/components/PageTitle';
import { shortId } from '@/shared/lib/shortId';

/**
 * 대여·반납·정산 상세가 공유하는 조각들.
 *
 * 세 화면 다 P1 이고 확정 API 가 없습니다 (WEB-API-CAND-003 / 005 / 007).
 * 이미지·얼굴 정보는 어떤 형태로도 넣지 않습니다 (§6.3 · GAP-WEB-001~002).
 */

/** 상단 요약 줄 — 상태 배지 + 식별자 + 오른쪽 이동 버튼들. */
export function DetailHeader({
    tone,
    statusLabel,
    id,
    documentTitle,
    actions,
}: {
    tone: BadgeTone;
    statusLabel: string;
    id: string;
    /** 브라우저 탭에 쓸 화면 이름 (예: '대여 상세') */
    documentTitle: string;
    actions?: ReactNode;
}) {
    return (
        <div className="mb-[18px] flex h-[58px] items-center rounded-lg bg-white px-[18px]">
            <Badge tone={tone}>{statusLabel}</Badge>
            {/* UUID 36자를 제목에 그대로 깔면 화면이 밀립니다. 전체 값은 아래 상세 행에 있습니다. */}
            <PageTitle className="ml-[14px] !text-[17px]" documentTitle={documentTitle}>
                {shortId(id)}
            </PageTitle>
            <div className="ml-auto flex items-center gap-2">{actions}</div>
        </div>
    );
}

/** 헤더 오른쪽의 보조 이동 버튼. 명령이 아니라 내비게이션입니다. */
export function DetailLinkButton({
    to,
    children,
    primary,
}: {
    to: string;
    children: ReactNode;
    primary?: boolean;
}) {
    return (
        <Link
            to={to}
            className={cn(
                'inline-flex h-[34px] items-center rounded-[7px] px-[14px] text-[12.5px] font-bold transition-colors',
                primary
                    ? 'bg-brand-blue text-white hover:bg-brand-blue/90'
                    : 'border border-brand-border-soft bg-white text-brand-body hover:bg-brand-surface',
            )}
        >
            {children}
        </Link>
    );
}

export function InfoCard({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="rounded-lg bg-white px-5 pb-[18px] pt-[18px]">
            <h3 className="mb-[6px] text-[14.5px] font-extrabold leading-none text-brand-ink">
                {title}
            </h3>
            <dl>{children}</dl>
        </section>
    );
}

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex h-[42px] items-center justify-between gap-4">
            <dt className="shrink-0 text-[12.5px] font-medium text-brand-body">{label}</dt>
            <dd className="min-w-0 truncate text-right text-[12.5px] font-bold text-brand-ink">
                {children}
            </dd>
        </div>
    );
}

/** 상세 안에서 다른 화면으로 넘어가는 값. 파란 글씨입니다. */
export function ValueLink({ to, children }: { to: string; children: ReactNode }) {
    return (
        <Link to={to} className="text-brand-blue-ink transition-opacity hover:opacity-70">
            {children}
        </Link>
    );
}

export interface TimelineStep {
    label: string;
    at: string;
    /** 아직 일어나지 않은 단계는 회색으로 둡니다. */
    done: boolean;
}

/**
 * 처리 타임라인.
 *
 * 도메인별 필드를 시간순 View 로 조합해 보여주는 것이지 범용 감사 테이블이 아닙니다
 * (§8.2 · §9.2 · §11.2 · §14 의 "범용 감사 테이블 존재를 전제하지 않는다").
 */
export function Timeline({ steps }: { steps: TimelineStep[] }) {
    return (
        <section className="rounded-lg bg-white px-5 pb-[26px] pt-[18px]">
            <h3 className="text-[14.5px] font-extrabold leading-none text-brand-ink">
                처리 타임라인
            </h3>

            <ol
                className="mt-[47px] grid"
                style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
            >
                {steps.map((step, index) => (
                    <li key={step.label} className="relative flex flex-col items-center">
                        {/* 단계 사이를 잇는 선. 원 지름(18) 밖에서만 그어 마지막 칸은 비웁니다. */}
                        {index < steps.length - 1 && (
                            <span
                                className="absolute left-[calc(50%+13px)] right-[calc(-50%+13px)] top-[9px] h-px bg-brand-line"
                                aria-hidden
                            />
                        )}

                        {/* 시안: 18px 원 + 완료 단계에만 8.2x6.4 체크 */}
                        <span
                            className={cn(
                                'relative z-10 flex size-[18px] items-center justify-center rounded-full',
                                step.done
                                    ? 'bg-brand-blue text-white'
                                    : 'border-[1.6px] border-brand-border-soft bg-white',
                            )}
                            aria-hidden
                        >
                            {step.done && (
                                <svg viewBox="0 0 18 18" className="size-[18px]">
                                    <path
                                        d="M5.4 9.4 L7.6 11.6 L12.9 6.2"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.9"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            )}
                        </span>

                        <span
                            className={cn(
                                'mt-[7px] text-[12.5px] font-bold',
                                step.done ? 'text-brand-ink' : 'text-brand-muted',
                            )}
                        >
                            {step.label}
                        </span>
                        <span className="mt-[4px] text-[11.5px] font-medium tabular-nums text-brand-muted">
                            {step.at}
                        </span>
                    </li>
                ))}
            </ol>
        </section>
    );
}

/** 상세 화면 맨 아래 안내 문구. */
export function DetailNote({ children }: { children: ReactNode }) {
    return (
        <p className="mt-[18px] text-[11.5px] font-medium leading-[18px] text-brand-muted">
            {children}
        </p>
    );
}
