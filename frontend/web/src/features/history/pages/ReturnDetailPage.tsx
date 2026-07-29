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
import { findReturn, findSettlement } from '@/features/history/mocks/history';
import { RETURN_STATUS_LABEL, RETURN_STATUS_TONE } from '@/features/history/types';
import { AI_RESULT_TONE } from '@/features/stations/types';
import { Badge } from '@/shared/components/Badge';
import { PageBar } from '@/shared/components/PageBar';

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
    const item = findReturn(returnAttemptId);

    if (!item) {
        return (
            <div>
                <PageBar breadcrumb={[{ label: '이력', to: '/history/returns' }]} />
                <div className="flex h-[200px] items-center justify-center rounded-lg bg-white text-[13px] font-medium text-brand-muted">
                    존재하지 않는 반납 시도입니다. ({returnAttemptId})
                </div>
            </div>
        );
    }

    const settlement = item.settlementId ? findSettlement(item.settlementId) : undefined;
    const reviewDone = item.status === 'REVIEW_DONE' || item.status === 'COMPLETED';

    return (
        <div>
            <PageBar
                className="mb-6"
                breadcrumb={[
                    { label: '이력', to: '/history/returns' },
                    { label: '반납 이력', to: '/history/returns' },
                    { label: item.returnAttemptId },
                ]}
            />

            <DetailHeader
                tone={RETURN_STATUS_TONE[item.status]}
                statusLabel={RETURN_STATUS_LABEL[item.status]}
                id={item.returnAttemptId}
                actions={
                    <>
                        <DetailLinkButton to={`/history/rentals/${item.rentalId}`}>
                            연결 대여 보기
                        </DetailLinkButton>
                        {item.inspectionId && (
                            <DetailLinkButton
                                to={`/stations/${item.stationId}/slots/${item.slotId}`}
                                primary
                            >
                                파손 검수로 이동
                            </DetailLinkButton>
                        )}
                    </>
                }
            />

            <div className="grid grid-cols-2 gap-4">
                <InfoCard title="반납 정보">
                    <InfoRow label="반납 ID">{item.returnAttemptId}</InfoRow>
                    <InfoRow label="반납 시각">{item.attemptedAt}</InfoRow>
                    <InfoRow label="반납 대여소">
                        <ValueLink to={`/stations/${item.stationId}`}>
                            {item.stationName} ({item.stationId})
                        </ValueLink>
                    </InfoRow>
                    <InfoRow label="슬롯">
                        {item.slotId ? (
                            <ValueLink to={`/stations/${item.stationId}/slots/${item.slotId}`}>
                                {item.slotId}
                            </ValueLink>
                        ) : (
                            <span className="text-brand-muted">슬롯 미선정</span>
                        )}
                    </InfoRow>
                    <InfoRow label="반납 사용자">
                        <ValueLink to={`/users/${item.userRef}/history`}>{item.userRef}</ValueLink>
                    </InfoRow>
                    <InfoRow label="연결 대여">
                        <ValueLink to={`/history/rentals/${item.rentalId}`}>
                            {item.rentalId}
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
                    <InfoRow label="관리자 판정">
                        {reviewDone ? '완료' : <span className="text-tone-amber-fg">대기 중</span>}
                    </InfoRow>
                </InfoCard>
            </div>

            <div className="mt-4">
                <Timeline
                    steps={[
                        { label: '반납 접수', at: item.attemptedAt.slice(11), done: true },
                        { label: 'AI 검수', at: item.attemptedAt.slice(11), done: true },
                        {
                            label: '관리자 판정',
                            at: reviewDone ? '완료' : '대기 중',
                            done: reviewDone,
                        },
                        {
                            label: '정산',
                            at: settlement?.createdAt.slice(11) ?? '—',
                            done: Boolean(settlement),
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
