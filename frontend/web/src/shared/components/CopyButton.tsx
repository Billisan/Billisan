import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * 복사 아이콘 — 겹친 사각형 두 개.
 *
 * 뒤 사각형은 앞 사각형에 가려지는 부분을 빼고 **보이는 테두리만** 경로로 그립니다.
 * 흰색으로 덧칠해 가리는 방식이 아니라서 버튼 hover 배경 위에서도 깨지지 않습니다.
 */
function CopyGlyph({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 19 19"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden
        >
            {/* 앞 사각형 */}
            <rect x="2" y="2" width="11" height="11" rx="2.4" />
            {/* 뒤 사각형 — 앞 사각형 밖으로 나온 부분만 */}
            <path d="M13 5.6h1.1a2.4 2.4 0 0 1 2.4 2.4v6.6a2.4 2.4 0 0 1-2.4 2.4H8a2.4 2.4 0 0 1-2.4-2.4V13" />
        </svg>
    );
}

/**
 * 값 전체를 클립보드로 복사하는 아이콘 버튼.
 *
 * UUID 처럼 화면에는 줄여서 보여주지만 백엔드·로그와 대조할 때는 36자 전부가 필요한 값에 답니다.
 *
 * `navigator.clipboard` 는 **보안 컨텍스트(https 또는 localhost)에서만** 동작합니다.
 * 배포된 관리자 Web 이 평문 http 로 열리면 그 API 자체가 없어서 조용히 실패합니다.
 * 그래서 실패하면 화면 밖 textarea 를 만들어 `document.execCommand('copy')` 로 대신합니다.
 * 낡은 API 지만 이 경우엔 유일하게 남은 길입니다.
 */
async function copyText(value: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return true;
        }
    } catch {
        // 권한 거부·비보안 컨텍스트 — 아래 대체 경로로 넘어갑니다.
    }

    try {
        const area = document.createElement('textarea');
        area.value = value;
        // 화면 밖에 두어 스크롤이 튀지 않게 합니다.
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        area.setAttribute('readonly', '');
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        return ok;
    } catch {
        return false;
    }
}

interface CopyButtonProps {
    /** 복사할 **전체** 값 */
    value: string;
    /** 스크린리더·툴팁 문구 (예: '반납 시도 ID') */
    label: string;
    className?: string;
}

export function CopyButton({ value, label, className }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);
    const timer = useRef<number | undefined>(undefined);

    // 언마운트 뒤 setState 를 막습니다.
    useEffect(() => () => window.clearTimeout(timer.current), []);

    const handleClick = async () => {
        const ok = await copyText(value);
        if (!ok) return;
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1600);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            title={copied ? '복사했습니다' : `${label} 전체 복사`}
            aria-label={`${label} 전체 복사`}
            className={cn(
                'inline-flex size-[22px] shrink-0 items-center justify-center rounded-[5px] text-brand-muted transition-colors hover:bg-brand-surface hover:text-brand-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40',
                className,
            )}
        >
            {copied ? (
                <Check className="size-[13px] text-tone-green-fg" aria-hidden />
            ) : (
                <CopyGlyph className="size-[14px]" />
            )}
            {/* 아이콘만으로는 결과를 알 수 없어 보조기기에 상태를 읽어 줍니다. */}
            <span className="sr-only" role="status">
                {copied ? '복사했습니다' : ''}
            </span>
        </button>
    );
}
