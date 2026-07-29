import { useParams } from 'react-router-dom';

import { useUserHistory } from '@/features/history/hooks/useHistory';
import { HISTORY_SYNCED_AT } from '@/features/history/mocks/history';
import { formatWon } from '@/features/history/types';
import { Badge } from '@/shared/components/Badge';
import { ErrorState, LoadingState } from '@/shared/components/PageState';
import { PageBar } from '@/shared/components/PageBar';
import { RefId } from '@/shared/components/RefId';
import { cn } from '@/lib/utils';

/**
 * 사용자 통합 이력 — `SCR-WEB-USER-HISTORY-001` (**P1**, `WEB-API-CAND-008`).
 *
 * 시안의 **`얼굴 프로필 기반` 배지를 뺐습니다.** `WF-WEB-CHANGE-009` 가 "얼굴 이미지·벡터·
 * 유사도는 금지. 필요성이 승인되면 `등록 여부`만 비생체 메타데이터로 표시"라고 했고,
 * `DEC-WEB-008` 권장안이 아예 `제거` 입니다. 얼굴 프로필 표시는 Orin 직접 조회를 유도합니다(§12).
 *
 * 표시 식별자는 내부 userId 축약뿐입니다. 이름·연락처·대학 계정 식별자는 근거와 권한이
 * 확정될 때만 마스킹 제공하고, `password_hash` 는 어떤 관리자 조회에도 제공하지 않습니다.
 */

const KIND_TONE = {
    대여: 'blue',
    반납: 'amber',
    정산: 'slate',
} as const;

const COLS = 'grid-cols-[162px_115px_153px_386px_1fr]';

export function UserHistoryPage() {
    const { userId } = useParams();
    const query = useUserHistory(userId);
    const user = query.data;

    if (query.isPending) return <LoadingState />;
    if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
    if (!user) {
        return (
            <div className="flex h-[200px] items-center justify-center rounded-lg bg-white text-[13px] font-medium text-brand-muted">
                존재하지 않는 사용자입니다. ({userId})
            </div>
        );
    }

    return (
        <div>
            <PageBar
                className="mb-6"
                breadcrumb={[{ label: '사용자 이력' }, { label: userId ?? user.userRef }]}
                meta={`${HISTORY_SYNCED_AT} 기준`}
            />

            <div className="mb-4 flex h-[76px] items-center rounded-lg bg-white px-[18px]">
                <span
                    className="flex size-[38px] items-center justify-center rounded-full bg-tone-blue-bg text-[15px] font-extrabold text-tone-blue-fg"
                    aria-hidden
                >
                    u
                </span>
                <h2 className="ml-[14px] text-[17px] font-extrabold leading-none text-brand-ink">
                    {userId ?? user.userRef}
                </h2>
                <span className="ml-[10px] text-[11.5px] font-medium text-brand-muted">
                    내부 식별자 축약 표시
                </span>

                <dl className="ml-auto flex items-center gap-[34px]">
                    <Summary label={`총 대여 · ${user.period}`} value={`${user.totalRentals}회`} />
                    <Summary label="정상 반납" value={`${user.normalReturns}회`} tone="green" />
                    <Summary
                        label="파손 · 분실"
                        value={`${user.damagedOrLost}회`}
                        tone={user.damagedOrLost > 0 ? 'red' : undefined}
                    />
                    <Summary
                        label="미정산"
                        value={formatWon(user.outstandingAmount)}
                        tone={user.outstandingAmount > 0 ? 'red' : undefined}
                    />
                </dl>
            </div>

            <h3 className="mb-[10px] text-[14.5px] font-extrabold leading-none text-brand-ink">
                이용 이력
            </h3>

            <div className="overflow-hidden rounded-lg bg-white">
                <div
                    className={cn(
                        'grid h-[42px] items-center bg-brand-surface px-[14px] text-[11.5px] font-bold text-brand-body',
                        COLS,
                    )}
                >
                    <span>시각</span>
                    <span>구분</span>
                    <span>연결 ID</span>
                    <span>대상</span>
                    <span>상태</span>
                </div>

                {user.timeline.map((entry, index) => (
                    <div
                        key={`${entry.kind}-${entry.linkId}`}
                        className={cn(
                            'relative grid h-[57px] items-center px-[14px] text-[12.5px]',
                            COLS,
                        )}
                    >
                        {index > 0 && (
                            <span
                                className="absolute inset-x-[14px] top-0 h-px bg-brand-line-soft"
                                aria-hidden
                            />
                        )}
                        <span className="font-medium tabular-nums text-brand-ink-soft">
                            {entry.at.slice(5)}
                        </span>
                        <span>
                            <Badge tone={KIND_TONE[entry.kind]}>{entry.kind}</Badge>
                        </span>
                        <span className="font-bold">
                            {/* RefId 가 링크까지 만듭니다. 표가 촘촘해 복사 버튼은 뺐습니다. */}
                            <RefId
                                id={entry.linkId}
                                label={`${entry.kind} ID`}
                                to={entry.to}
                                hideCopy
                            />
                        </span>
                        <span className="truncate font-medium text-brand-ink-soft">
                            {entry.target}
                        </span>
                        <span>
                            <Badge tone={entry.statusTone}>{entry.statusLabel}</Badge>
                        </span>
                    </div>
                ))}
            </div>

            <p className="mt-[18px] text-[11.5px] font-medium leading-[18px] text-brand-muted">
                집계는 {user.period} 기준입니다. 얼굴 등록 여부·프로필은 표시하지 않습니다.
                대여·반납· 정산을 하나의 시간축으로 잇되 최소 식별자만 사용합니다.
            </p>
        </div>
    );
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
    return (
        <div className="text-right">
            <dt className="text-[11.5px] font-medium text-brand-muted">{label}</dt>
            <dd
                className={cn(
                    'mt-[5px] text-[15px] font-extrabold leading-none tabular-nums',
                    tone === 'green' && 'text-tone-green-fg',
                    tone === 'red' && 'text-tone-red-fg',
                    !tone && 'text-brand-ink',
                )}
            >
                {value}
            </dd>
        </div>
    );
}
