import { useParams } from 'react-router-dom';

import {
    DetailHeader,
    DetailLinkButton,
    DetailNote,
    InfoCard,
    InfoRow,
    Timeline,
    ValueLink,
} from '@/features/history/components/DetailShell';
import { findSettlement } from '@/features/history/mocks/history';
import {
    RETURN_STATUS_LABEL,
    RETURN_STATUS_TONE,
    REVIEW_STATUS_LABEL,
    SETTLEMENT_STATUS_LABEL,
} from '@/features/history/types';
import { AI_RESULT_TONE } from '@/features/stations/types';
import { Badge } from '@/shared/components/Badge';
import { useReturnAttempt } from '@/features/history/hooks/useHistory';
import { ErrorState, LoadingState } from '@/shared/components/PageState';
import { PageBar } from '@/shared/components/PageBar';
import { RefId } from '@/shared/components/RefId';
import { shortId } from '@/shared/lib/shortId';

/**
 * 반납 상세 — `SCR-WEB-RETURN-DETAIL-001` (**P1**, `WEB-API-CAND-005`).
 *
 * 시안과 다른 점 하나: **`촬영 이미지 — 있음 (2장)` 줄을 뺐습니다.**
 * `GAP-WEB-002` 가 이걸 `SECURITY_REJECTED` 로 판정했고 `WF-WEB-CHANGE-002` 가
 * "`촬영 이미지 있음`을 `촬영·추론 처리 완료 / 원본 미저장`으로 교체. 이미지 존재 Boolean 을
 * API 에 요구하지 않는다"고 지시합니다. 그래서 장수·존재 여부 대신 처리 결과만 남깁니다.
 *
 * AI 결과 값 집합은 `NORMAL|DAMAGED|UNCERTAIN|FAILED` 입니다 (§17).
 * 시안의 `ADMIN_REVIEW` 는 슬롯 상태라 여기 쓰지 않습니다.
 */
export function ReturnDetailPage() {
    const { returnAttemptId } = useParams();
    const query = useReturnAttempt(returnAttemptId);
    const item = query.data;

    if (query.isPending) return <LoadingState />;
    if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

    if (!item) {
        return (
            <div>
                <PageBar breadcrumb={[{ label: '이력', to: '/history/returns' }]} />
                <div className="flex h-[200px] items-center justify-center rounded-lg bg-white text-[13px] font-medium text-brand-muted">
                    존재하지 않는 반납 시도입니다. (
                    {returnAttemptId ? shortId(returnAttemptId) : '-'})
                </div>
            </div>
        );
    }

    const settlement = item.settlementId ? findSettlement(item.settlementId) : undefined;
    /*
     * 관리자 판정이 끝났는지. **반납 상태로 판단하면 안 됩니다** — 예전에는
     * `status === 'COMPLETED'` 를 판정 완료로 읽어서, 검수가 미처리인 반납도 '완료' 로
     * 보였습니다. 두 축은 서로 다릅니다(ERD §8.0). 검수가 안 걸린 반납은 `null` 이고
     * 그건 '판정할 게 없음' 이라 완료로 봅니다.
     */
    const reviewPending = item.reviewStatus === 'PENDING';
    const reviewLabel =
        item.reviewStatus === null ? '해당 없음' : REVIEW_STATUS_LABEL[item.reviewStatus];

    return (
        <div>
            <PageBar
                className="mb-[18px]"
                breadcrumb={[
                    { label: '이력', to: '/history/returns' },
                    { label: '반납 이력', to: '/history/returns' },
                    { label: shortId(item.returnAttemptId) },
                ]}
            />

            <DetailHeader
                tone={RETURN_STATUS_TONE[item.status]}
                statusLabel={RETURN_STATUS_LABEL[item.status]}
                documentTitle="반납 상세"
                id={item.returnAttemptId}
                actions={
                    <>
                        <DetailLinkButton to={`/history/rentals/${item.rentalId}`}>
                            연결 대여 보기
                        </DetailLinkButton>
                        {item.inspectionId && (
                            <DetailLinkButton to={`/slots/${item.slotId}`} primary>
                                파손 검수로 이동
                            </DetailLinkButton>
                        )}
                    </>
                }
            />

            <div className="grid grid-cols-2 gap-4">
                <InfoCard title="반납 정보">
                    <InfoRow label="반납 ID">
                        <RefId id={item.returnAttemptId} label="반납 시도 ID" />
                    </InfoRow>
                    <InfoRow label="반납 시각">{item.attemptedAt}</InfoRow>
                    <InfoRow label="반납 대여소">
                        <ValueLink to={`/stations/${item.stationId}`}>
                            {item.stationName} ({item.stationId})
                        </ValueLink>
                    </InfoRow>
                    <InfoRow label="슬롯">
                        {item.slotId ? (
                            <ValueLink to={`/slots/${item.slotId}`}>{item.slotLabel}</ValueLink>
                        ) : (
                            <span className="text-brand-muted">슬롯 미선정</span>
                        )}
                    </InfoRow>
                    <InfoRow label="반납 사용자">
                        <ValueLink to={`/users/${item.userRef}/history`}>
                            {shortId(item.userRef)}
                        </ValueLink>
                    </InfoRow>
                    <InfoRow label="연결 대여">
                        <ValueLink to={`/history/rentals/${item.rentalId}`}>
                            {shortId(item.rentalId)}
                        </ValueLink>
                    </InfoRow>
                </InfoCard>

                <InfoCard title="AI 검수 결과 (참고)">
                    <InfoRow label="판정 결과">
                        <Badge tone={AI_RESULT_TONE[item.aiResult]}>{item.aiResult}</Badge>
                    </InfoRow>
                    <InfoRow label="신뢰도">{item.aiScore.toFixed(2)}</InfoRow>
                    <InfoRow label="모델 버전">{item.modelVersion}</InfoRow>
                    <InfoRow label="추론 지연">{item.latencyMs}ms</InfoRow>
                    {/* 이미지 존재 여부·장수 대신 '처리했고 원본은 남기지 않았다'만 남깁니다. */}
                    <InfoRow label="촬영 처리">촬영·추론 완료 / 원본 미저장</InfoRow>
                    <InfoRow label="관리자 검수">
                        {reviewPending ? (
                            <span className="text-tone-amber-fg">{reviewLabel}</span>
                        ) : (
                            reviewLabel
                        )}
                    </InfoRow>
                </InfoCard>
            </div>

            <div className="mt-4">
                <Timeline
                    steps={[
                        { label: '반납 접수', at: item.attemptedAt.slice(11), done: true },
                        { label: 'AI 검수', at: item.attemptedAt.slice(11), done: true },
                        {
                            label: '관리자 검수',
                            at: reviewLabel,
                            done: !reviewPending,
                        },
                        /*
                         * 정산 단계는 **정산이 실제로 생겼고 결제까지 끝났을 때만** 완료입니다.
                         * 예전에는 정산 행이 있으면 체크가 찍혀서, 미정산(PENDING)인데 돈을
                         * 받은 것처럼 보였습니다.
                         *
                         * 검수가 미처리면 파손 정산은 아직 없는 게 정상입니다 — ERD §8.0 이
                         * "AI 추론은 자동 파손 확정이나 자동 과금이 아니다" 라고 못 박았고,
                         * 파손 정산은 ADMIN-INSPECTION-003 판정에서 생깁니다.
                         */
                        {
                            label: '정산',
                            at: settlement ? SETTLEMENT_STATUS_LABEL[settlement.status] : '없음',
                            done: settlement?.status === 'PAID',
                        },
                    ]}
                />
            </div>

            <DetailNote>
                AI 결과는 보조 판정이며 이것만으로 파손이 확정되지 않습니다. 원본 촬영 이미지는
                저장·전송하지 않으므로 관리자는 현장 실물로 판정합니다. 늦게 도착한 AI 결과가 관리자
                판정을 덮지 않습니다.
            </DetailNote>
        </div>
    );
}
