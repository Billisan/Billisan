import { RotateCw } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * 대시보드 카드 하나가 조회에 실패했을 때 그 자리에만 보이는 안내.
 *
 * 화면흐름 §16 이 요구하는 모양입니다 — "**영역별 부분 실패**를 표시하고 영역 단위 재시도를
 * 제공한다". 카드 하나가 실패했다고 대시보드 전체를 오류 화면으로 덮으면, 멀쩡한 나머지
 * 정보까지 못 보게 됩니다. 반대로 조용히 비워 두면 "데이터가 없다"로 읽힙니다.
 *
 * 세 카드가 서로 다르게 말하지 않도록 문구·간격을 한곳에 모았습니다.
 */
interface PanelStateProps {
    /** 조회 중 */
    pending: boolean;
    /** 조회 실패 */
    failed: boolean;
    /** 실패했을 때 보여줄 문장. 카드마다 무엇을 못 불러왔는지 다릅니다. */
    message: string;
    /** 이 영역만 다시 조회합니다. */
    onRetry: () => void;
    className?: string;
}

export function PanelState({ pending, failed, message, onRetry, className }: PanelStateProps) {
    if (!pending && !failed) return null;

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-[10px] py-6 text-center',
                className,
            )}
            // 실패는 읽고 지나가면 안 되는 정보라 스크린리더에도 알립니다.
            role={failed ? 'alert' : undefined}
        >
            <p className="text-[12px] font-medium text-brand-muted">
                {pending ? '불러오는 중…' : message}
            </p>

            {failed && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="flex items-center gap-[6px] rounded-lg bg-brand-surface px-[11px] py-[6px] text-[11.5px] font-bold text-brand-body transition-colors hover:bg-brand-track focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40"
                >
                    <RotateCw className="size-[12px]" strokeWidth={2.4} aria-hidden />
                    다시 시도
                </button>
            )}
        </div>
    );
}
