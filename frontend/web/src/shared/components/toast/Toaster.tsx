import { Check, TriangleAlert, X } from 'lucide-react';

import { useToastStore, type ToastTone } from '@/shared/components/toast/toastStore';
import { cn } from '@/lib/utils';

/**
 * 화면 우측 아래에 쌓이는 알림.
 *
 * 성공은 `aria-live="polite"` 로 조용히, 오류는 `role="alert"` 로 즉시 읽히게 둡니다.
 * 오류를 polite 로 두면 스크린리더가 다음 발화까지 기다려서, 정작 실패했다는 걸 늦게 압니다.
 */

const TONE: Record<ToastTone, { bar: string; icon: string; Icon: typeof Check }> = {
    success: { bar: 'bg-tone-green-fg', icon: 'text-tone-green-fg', Icon: Check },
    error: { bar: 'bg-tone-red-fg', icon: 'text-tone-red-fg', Icon: TriangleAlert },
    info: { bar: 'bg-brand-blue', icon: 'text-brand-blue', Icon: Check },
};

export function Toaster() {
    const toasts = useToastStore((s) => s.toasts);
    const dismiss = useToastStore((s) => s.dismiss);

    if (toasts.length === 0) return null;

    return (
        <div
            className="pointer-events-none fixed bottom-6 right-6 z-[60] flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-[10px]"
            aria-live="polite"
        >
            {toasts.map(({ id, tone, message, detail }) => {
                const { bar, icon, Icon } = TONE[tone];

                return (
                    <div
                        key={id}
                        role={tone === 'error' ? 'alert' : 'status'}
                        className="pointer-events-auto flex overflow-hidden rounded-[10px] bg-white shadow-[0_8px_24px_rgba(11,18,32,0.18)]"
                    >
                        {/* 색 막대. 아이콘만으로 구분하지 않도록 폭을 줍니다. */}
                        <span className={cn('w-[4px] shrink-0', bar)} aria-hidden />

                        <div className="flex min-w-0 flex-1 items-start gap-[10px] py-[13px] pl-[14px] pr-[10px]">
                            <Icon
                                className={cn('mt-[1px] size-[15px] shrink-0', icon)}
                                strokeWidth={2.4}
                                aria-hidden
                            />
                            <div className="min-w-0 flex-1">
                                <p className="text-[12.5px] font-bold leading-[1.45] text-brand-ink">
                                    {message}
                                </p>
                                {detail && (
                                    <p className="mt-[3px] break-words text-[11.5px] font-medium leading-[1.45] text-brand-muted">
                                        {detail}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => dismiss(id)}
                                className="shrink-0 rounded p-[3px] text-brand-muted transition-colors hover:bg-brand-surface"
                            >
                                <span className="sr-only">알림 닫기</span>
                                <X className="size-[13px]" strokeWidth={2.2} aria-hidden />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
