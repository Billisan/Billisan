import { useId, type ComponentType, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * 사이드바 아이콘 모음. 좌표는 시안의 24x24 벡터 그대로입니다.
 *
 * lucide 는 선(stroke) 아이콘이라 시안의 면(fill) 아이콘과 인상이 많이 달라서 직접 그립니다.
 * 색은 currentColor 를 따르고, 안쪽을 파낸 부분(방패의 체크 표시 등)은 mask 로 뚫습니다.
 * 배경색을 덧칠하지 않고 뚫어야 기본/hover/활성 배경에서 모두 자연스럽습니다.
 */

export type NavIcon = ComponentType<{ className?: string }>;

/** 시안 기준 아이콘 크기: 24 * 0.86 */
const SIZE = 'size-[20.64px]';

function Svg({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <svg viewBox="0 0 24 24" className={cn(SIZE, 'shrink-0', className)} aria-hidden>
            {children}
        </svg>
    );
}

/** mask 참조용 id. useId 의 콜론은 url(#...) 에서 헷갈릴 수 있어 걷어냅니다. */
function useMaskId() {
    return `nav-mask-${useId().replace(/:/g, '')}`;
}

export function HomeIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path
                d="M12 2.4 L22 11.3 L20 11.3 L20 21.6 L14.2 21.6 L14.2 14.6 L9.8 14.6 L9.8 21.6 L4 21.6 L4 11.3 L2 11.3 Z"
                fill="currentColor"
            />
        </Svg>
    );
}

export function GridIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <rect x="2.5" y="2.5" width="8.5" height="8.5" rx="1.9" fill="currentColor" />
            <rect x="13" y="2.5" width="8.5" height="8.5" rx="1.9" fill="currentColor" />
            <rect x="2.5" y="13" width="8.5" height="8.5" rx="1.9" fill="currentColor" />
            <rect x="13" y="13" width="8.5" height="8.5" rx="1.9" fill="currentColor" />
        </Svg>
    );
}

export function UmbrellaIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            <path
                d="M12 2.2 C6.4 2.2 2 6.8 2 12.4 L22 12.4 C22 6.8 17.6 2.2 12 2.2 Z"
                fill="currentColor"
            />
            <rect x="11.1" y="12.4" width="1.9" height="6.4" fill="currentColor" />
            <path
                d="M11.1 18.6 A3.5 3.5 0 0 0 18.1 18.6 L16.2 18.6 A1.6 1.6 0 0 1 13 18.6 Z"
                fill="currentColor"
            />
        </Svg>
    );
}

export function ListIcon({ className }: { className?: string }) {
    return (
        <Svg className={className}>
            {[5.6, 12, 18.4].map((cy) => (
                <circle key={cy} cx="4" cy={cy} r="1.9" fill="currentColor" />
            ))}
            {[4.3, 10.7, 17.1].map((y) => (
                <rect
                    key={y}
                    x="8.2"
                    y={y}
                    width="13.6"
                    height="2.6"
                    rx="1.3"
                    fill="currentColor"
                />
            ))}
        </Svg>
    );
}

export function ShieldCheckIcon({ className }: { className?: string }) {
    const maskId = useMaskId();

    return (
        <Svg className={className}>
            <mask id={maskId}>
                <rect width="24" height="24" fill="#fff" />
                <path
                    d="M8.4 11.7 L11.0 14.4 L15.9 9.4"
                    fill="none"
                    stroke="#000"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </mask>
            <path
                d="M12 1.9 L20.6 5.0 V11.6 C20.6 16.7 17.1 21.0 12 22.4 C6.9 21.0 3.4 16.7 3.4 11.6 V5.0 Z"
                fill="currentColor"
                mask={`url(#${maskId})`}
            />
        </Svg>
    );
}

export function MapPinIcon({ className }: { className?: string }) {
    const maskId = useMaskId();

    return (
        <Svg className={className}>
            <mask id={maskId}>
                <rect width="24" height="24" fill="#fff" />
                <circle cx="12" cy="9.9" r="2.9" fill="#000" />
            </mask>
            <path
                d="M12 1.8 A8.1 8.1 0 0 0 3.9 9.9 C3.9 15.6 12 22.5 12 22.5 C12 22.5 20.1 15.6 20.1 9.9 A8.1 8.1 0 0 0 12 1.8 Z"
                fill="currentColor"
                mask={`url(#${maskId})`}
            />
        </Svg>
    );
}

export function ClipboardIcon({ className }: { className?: string }) {
    const maskId = useMaskId();

    return (
        <Svg className={className}>
            {/* 마스크는 그린 순서대로 덮어씁니다: 집게 자리를 뚫고 → 집게를 다시 살리고 → 줄 2개를 뚫음 */}
            <mask id={maskId}>
                <rect width="24" height="24" fill="#fff" />
                <rect x="7.3" y="1.9" width="9.4" height="5.6" rx="1.7" fill="#000" />
                <rect x="8.6" y="1.2" width="6.8" height="4.4" rx="1.4" fill="#fff" />
                <rect x="7.2" y="11.0" width="9.6" height="2.0" rx="1.0" fill="#000" />
                <rect x="7.2" y="15.4" width="6.6" height="2.0" rx="1.0" fill="#000" />
            </mask>
            <g fill="currentColor" mask={`url(#${maskId})`}>
                <rect x="3.8" y="4.0" width="16.4" height="18.0" rx="2.6" />
                <rect x="8.6" y="1.2" width="6.8" height="4.4" rx="1.4" />
            </g>
        </Svg>
    );
}
