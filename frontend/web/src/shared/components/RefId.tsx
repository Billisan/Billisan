import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { CopyButton } from '@/shared/components/CopyButton';
import { shortId } from '@/shared/lib/shortId';

/**
 * 거래 식별자 표시 — `rentalId` · `returnAttemptId` · `settlementId` · `inspectionId` 등.
 *
 * ERD 는 모든 PK 가 `CHAR(36)` UUID 이고 사람이 읽을 코드 컬럼이 없습니다. 표에 36자를 깔면
 * 다른 열이 다 밀려서 **앞 8자만 보여주되, 전체 값에 닿을 길을 반드시 남깁니다.**
 *   - `title` — 마우스를 올리면 36자 전체
 *   - `select-all` — 한 번 클릭으로 전체 선택
 *   - 복사 버튼 — 클립보드로 36자 전체
 * 관리자가 백엔드 로그·문의와 대조하려면 전체 값이 필요합니다.
 *
 * `to` 를 주면 링크가 됩니다. 없으면 파란 글자로 만들지 않습니다 — 링크처럼 보이는데 눌리지
 * 않는 게 제일 나쁩니다.
 */
interface RefIdProps {
    id: string | null | undefined;
    /** 스크린리더·툴팁에 쓸 이름 (예: '대여 ID') */
    label: string;
    /** 이동할 화면. 없으면 글자로만 보여줍니다. */
    to?: string | null;
    /** 복사 버튼을 감출지 (촘촘한 표에서) */
    hideCopy?: boolean;
    className?: string;
}

export function RefId({ id, label, to, hideCopy, className }: RefIdProps) {
    if (!id) {
        return (
            <span className="text-brand-muted" aria-label={`${label} 없음`}>
                —
            </span>
        );
    }

    const short = shortId(id);

    return (
        <span className={cn('inline-flex items-center gap-[6px]', className)}>
            {to ? (
                <Link
                    to={to}
                    title={id}
                    className="text-[13px] font-bold tabular-nums text-brand-blue-ink underline-offset-2 transition-opacity hover:underline hover:opacity-70"
                >
                    {short}
                </Link>
            ) : (
                <span
                    title={id}
                    className="cursor-text select-all text-[13px] font-bold tabular-nums text-brand-ink-soft"
                >
                    {short}
                </span>
            )}
            {!hideCopy && <CopyButton value={id} label={label} />}
        </span>
    );
}
