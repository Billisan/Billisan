import { formatScore } from '@/features/inspections/lib/aiScore';
import type { InspectionReviewStatus } from '@/features/inspections/types';
import {
    aiResultHint,
    aiResultText,
    aiResultTone,
    type AiInspectionResult,
} from '@/features/stations/types';
import { Badge, type BadgeTone } from '@/shared/components/Badge';
import { codeHint, REVIEW_STATUS_LABEL } from '@/shared/constants/statusLabels';
import { cn } from '@/lib/utils';

/**
 * 검수 목록·상세가 같이 쓰는 조각들.
 *
 * 세 값 집합을 화면에서도 섞지 않는 게 목적입니다.
 * AI 결과 배지는 슬롯 상태 배지(`SLOT_DISPLAY_TONE`)와 톤 표를 따로 씁니다.
 */

/**
 * AI 보조 결과 배지.
 *
 * `InspectionResult` 의 네 값 + **null(분석 전)** 이 들어옵니다. 시안에는 이 칸에
 * `ADMIN_REVIEW`(슬롯 상태)와 `오염 의심`(계약에 없는 말)이 섞여 있었는데, 값 집합이
 * 달라서 그대로 쓸 수 없습니다.
 */
export function AiResultBadge({ result }: { result: AiInspectionResult | null }) {
    return (
        <Badge
            tone={aiResultTone(result)}
            className="whitespace-nowrap"
            title={aiResultHint(result)}
        >
            {aiResultText(result)}
        </Badge>
    );
}

/** 관리자 처리 여부 배지. AI 결과가 아니라 '사람이 봤는가'입니다. */
export function ReviewStatusBadge({ status }: { status: InspectionReviewStatus }) {
    return (
        <Badge
            tone={status === 'PENDING' ? 'amber' : 'green'}
            className="whitespace-nowrap"
            title={codeHint(REVIEW_STATUS_LABEL, status)}
        >
            {REVIEW_STATUS_LABEL[status]}
        </Badge>
    );
}

/**
 * 배지 톤 → 막대 색. 문자열 리터럴이어야 Tailwind JIT 가 클래스를 뽑아냅니다.
 *
 * `BadgeTone` 전체를 덮어야 합니다. 색을 하나 추가하고 여기를 빠뜨리면 타입 오류로
 * 바로 잡힙니다 — `Record<BadgeTone, string>` 으로 못 박아 둔 이유입니다.
 */
const BAR_CLASS: Record<BadgeTone, string> = {
    green: 'bg-tone-green-fg',
    blue: 'bg-tone-blue-fg',
    amber: 'bg-tone-amber-fg',
    red: 'bg-tone-red-fg',
    slate: 'bg-tone-slate-fg',
    violet: 'bg-tone-violet-fg',
};

/**
 * 신뢰도 구간 → 막대 색.
 *
 * **막대 색은 「얼마나 확실한가」입니다. 판정 결과가 아닙니다.**
 *
 * 예전에는 `aiResultTone(result)` 를 써서 파손이면 빨강, 정상이면 초록으로 칠했습니다.
 * 그러면 「신뢰도 0.93」이 빨간 막대로 나옵니다 — 라벨은 '신뢰도'라고 적어 놓고 색은
 * 판정을 말하니, 높은 숫자에 경고색이 붙어 **확신도가 낮다는 뜻으로 읽혔습니다.**
 *
 * 판정 결과는 같은 줄의 AI 판정 배지(`AiResultBadge`)가 이미 색으로 말합니다. 두 자리가
 * 같은 것을 말할 이유가 없어서, 막대는 라벨이 가리키는 값(신뢰도)만 나타냅니다.
 *   0.85 이상 — 초록. AI 가 확실하다고 본 것
 *   0.70 이상 — 주황. 참고는 되지만 사람이 더 봐야 함
 *   그 미만   — 빨강. 이 숫자만 믿고 판정하면 안 됨
 *
 * **경계값은 운영에서 조정할 수 있습니다.** 모델의 실제 정확도를 근거로 정한 값이 아니라
 * "이 정도면 믿고 넘어갈 만한가"에 대한 팀의 판단입니다. 오판이 잦으면 올리고, 멀쩡한
 * 건이 자꾸 주황으로 걸리면 내리면 됩니다 — 두 숫자만 고치면 화면 전체에 반영됩니다.
 * TODO: 모델 성능 지표가 나오면 그 값으로 다시 맞추세요.
 */
const CONFIDENCE_SURE = 0.85;
const CONFIDENCE_FAIR = 0.7;

function confidenceTone(score: number): 'green' | 'amber' | 'red' {
    if (score >= CONFIDENCE_SURE) return 'green';
    if (score >= CONFIDENCE_FAIR) return 'amber';
    return 'red';
}

/**
 * 신뢰도 + 막대.
 *
 * **화면 표기는 「신뢰도」로 통일합니다.** 예전에는 같은 값을 화면마다 다르게 불렀습니다 —
 * 반납 상세는 「신뢰도」, 검수 목록·상세는 「추론 점수」, 슬롯 상세는 「점수」. 관리자가
 * 서로 다른 값으로 오해할 여지가 있습니다.
 *
 * 기준은 ERD 입니다. `DAMAGE_INSPECTION.confidence DECIMAL(5,4) CHECK 0..1` 의 설명이
 * 「신뢰도」이고, "`COMPLETED` 에는 유효 결과·**신뢰도**·모델 버전이 필수이며 `FAILED` 에는
 * 결과·**신뢰도**가 NULL", "관리자는 AI 결과, **신뢰도**, 모델 버전 ... 을 기준으로 판정한다"
 * 로 일관됩니다. 12-R 의 필드명만 `aiScore` 이고 화면 표기는 신뢰도입니다.
 *
 * `FAILED` 는 값 자체가 없어서 막대를 그리지 않습니다. 0.00 으로 채우면
 * '아주 확실하게 정상'처럼 읽혀 반대로 오해됩니다.
 */
export function ScoreBar({ score, className }: { score: number | null; className?: string }) {
    if (score === null) {
        return (
            <span className={cn('block text-[11.5px] font-medium text-brand-muted', className)}>
                신뢰도 없음
            </span>
        );
    }

    return (
        <span className={cn('block', className)}>
            <span className="block text-[13px] font-extrabold leading-none tabular-nums text-brand-ink">
                {formatScore(score)}
            </span>
            <span className="mt-[10px] block h-[6px] w-full overflow-hidden rounded-full bg-brand-track">
                <span
                    className={cn('block h-full rounded-full', BAR_CLASS[confidenceTone(score)])}
                    style={{ width: `${Math.round(score * 100)}%` }}
                />
            </span>
        </span>
    );
}

/**
 * 사진 자리를 대신하는 안내.
 *
 * 값을 비워 두는 게 아니라 **왜 비어 있는지**를 적습니다. 관리자 Web 은 이미지를
 * 원본·썸네일·URL·경로·key·Base64 어떤 형태로도 받지 않기로 계약돼 있습니다 (API명세 B-4.1 · D-2).
 */
export function NoImageNotice({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center rounded-[10px] bg-brand-surface px-8 py-9 text-center',
                className,
            )}
        >
            <ShieldMark />
            <p className="mt-[17px] text-[13px] font-bold text-[#667A8A]">
                검수 이미지는 제공되지 않습니다
            </p>
            <p className="mt-[9px] text-[11.5px] font-medium leading-[1.6] text-brand-muted">
                AI 는 판정 여부와 신뢰도만 전달합니다.
                <br />
                현장에서 실물을 확인한 뒤 판정하세요.
            </p>
        </div>
    );
}

/** 시안 벡터 그대로. lucide 방패는 획이 얇아 대비가 약합니다. */
function ShieldMark() {
    return (
        <svg viewBox="0 0 24 24" width="41" height="41" aria-hidden>
            <path
                d="M12 1.9 L20.6 5.0 V11.6 C20.6 16.7 17.1 21.0 12 22.4 C6.9 21.0 3.4 16.7 3.4 11.6 V5.0 Z"
                fill="#E2E7EB"
            />
            <path
                d="M8.4 11.7 L11.0 14.4 L15.9 9.4"
                fill="none"
                stroke="#F4F6F8"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

/**
 * 이전/다음만 있는 페이지 이동.
 *
 * `ADMIN-INSPECTION-001` 응답은 `items` 와 `nextCursor` 뿐이라 총 건수도 총 페이지 수도
 * 없습니다. 시안의 `1 2 3 4 5 … 8` 처럼 임의 페이지로 뛰려면 offset 이 필요한데
 * cursor 는 불투명 문자열이라 클라이언트가 해석할 수 없습니다 (목록 공통 규칙).
 * '이전'은 지금까지 지나온 cursor 를 되짚어 돌아갑니다.
 */
export function CursorPager({
    canPrev,
    canNext,
    onPrev,
    onNext,
}: {
    canPrev: boolean;
    canNext: boolean;
    onPrev: () => void;
    onNext: () => void;
}) {
    const base =
        'h-[30px] rounded-[7px] border border-brand-border-soft bg-white px-[14px] text-[12px] font-semibold text-brand-body transition-colors hover:bg-brand-surface disabled:cursor-not-allowed disabled:opacity-40';

    return (
        <nav className="flex items-center gap-2" aria-label="페이지 이동">
            <button type="button" onClick={onPrev} disabled={!canPrev} className={base}>
                이전
            </button>
            <button type="button" onClick={onNext} disabled={!canNext} className={base}>
                다음
            </button>
        </nav>
    );
}
