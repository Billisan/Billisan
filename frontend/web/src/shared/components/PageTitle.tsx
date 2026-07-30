import { useEffect } from 'react';

import { env } from '@/config/env';
import { cn } from '@/lib/utils';

/**
 * 화면마다 하나씩 두는 제목.
 *
 * 두 가지를 한 번에 합니다.
 *
 * 1. **`<h1>`** — 화면에 제목이 하나는 있어야 합니다. 스크린리더 사용자는 제목을 훑어
 *    지금 어느 화면인지 파악하는데, 앱 전체에 `h1` 이 하나도 없으면 그 경로가 막힙니다.
 *    제목 단계도 `h1 → h2 → h3` 로 이어져야지 `h2` 부터 시작하면 안 됩니다.
 * 2. **브라우저 탭 제목** — 전부 '빌리산 관리자' 하나면 탭을 여러 개 띄웠을 때 구분이
 *    안 됩니다. 앞에 화면 이름을 붙입니다.
 *
 * 시각적으로 제목을 보여줄 자리가 없는 화면(대시보드처럼 카드로 시작하는 화면)은
 * `visuallyHidden` 으로 글자만 숨깁니다. `display:none` 이 아니라 화면 밖으로 밀어내는
 * 방식이라 보조기기에는 그대로 읽힙니다.
 */
interface PageTitleProps {
    children: string;
    /** 탭 제목에 쓸 짧은 이름. 없으면 `children` 을 그대로 씁니다. */
    documentTitle?: string;
    /** 화면에는 감추고 보조기기에만 남깁니다. */
    visuallyHidden?: boolean;
    className?: string;
}

export function PageTitle({ children, documentTitle, visuallyHidden, className }: PageTitleProps) {
    const tabName = documentTitle ?? children;

    useEffect(() => {
        const previous = document.title;
        document.title = `${tabName} · ${env.appName}`;
        // 화면을 떠나면 되돌립니다. 다음 화면이 자기 제목으로 다시 덮습니다.
        return () => {
            document.title = previous;
        };
    }, [tabName]);

    return (
        <h1
            className={cn(
                visuallyHidden
                    ? 'sr-only'
                    : 'text-[21px] font-extrabold leading-none text-brand-ink',
                className,
            )}
        >
            {children}
        </h1>
    );
}
