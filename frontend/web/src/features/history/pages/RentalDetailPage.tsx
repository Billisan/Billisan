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
import { RENTAL_STATUS_LABEL, RENTAL_STATUS_TONE } from '@/features/history/types';
import { Badge } from '@/shared/components/Badge';
import { useRental } from '@/features/history/hooks/useHistory';
import { ErrorState, LoadingState } from '@/shared/components/PageState';
import { PageBar } from '@/shared/components/PageBar';
import { RefId } from '@/shared/components/RefId';
import { shortId } from '@/shared/lib/shortId';

/**
 * 대여 상세 — `SCR-WEB-RENTAL-DETAIL-001` (**P1**, `WEB-API-CAND-003`).
 *
 * 한 대여에 실패 반납 시도가 여러 개일 수 있어 `연결 반납` 을 단일 행으로 단정하지 않습니다.
 * 여기서는 **완료 시도 1건**만 보여주고, 전체 시도는 반납 이력에서 봅니다 (§8.2).
 * 대여 건 자체에는 AI 검수가 없습니다. 검수·판정·정산은 반납 시점부터 생깁니다.
 */
export function RentalDetailPage() {
    const { rentalId } = useParams();
    const query = useRental(rentalId);
    const rental = query.data;

    if (query.isPending) return <LoadingState />;
    if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

    if (!rental) {
        return (
            <div>
                <PageBar breadcrumb={[{ label: '이력', to: '/history/rentals' }]} />
                <div className="flex h-[200px] items-center justify-center rounded-lg bg-white text-[13px] font-medium text-brand-muted">
                    존재하지 않는 대여입니다. ({rentalId})
                </div>
            </div>
        );
    }

    const linkedReturn = rental.returnAttemptId ? findReturn(rental.returnAttemptId) : undefined;
    const linkedSettlement = rental.settlementId ? findSettlement(rental.settlementId) : undefined;

    return (
        <div>
            <PageBar
                className="mb-6"
                breadcrumb={[
                    { label: '이력', to: '/history/rentals' },
                    { label: '대여 이력', to: '/history/rentals' },
                    { label: shortId(rental.rentalId) },
                ]}
            />

            <DetailHeader
                tone={RENTAL_STATUS_TONE[rental.status]}
                statusLabel={RENTAL_STATUS_LABEL[rental.status]}
                documentTitle="대여 상세"
                id={rental.rentalId}
                actions={
                    <>
                        <DetailLinkButton to={`/users/${rental.userRef}/history`}>
                            사용자 이력
                        </DetailLinkButton>
                        {rental.returnAttemptId && (
                            <DetailLinkButton
                                to={`/history/returns/${rental.returnAttemptId}`}
                                primary
                            >
                                반납 상세 보기
                            </DetailLinkButton>
                        )}
                    </>
                }
            />

            <div className="grid grid-cols-2 gap-4">
                <InfoCard title="대여 정보">
                    <InfoRow label="대여 ID">
                        <RefId id={rental.rentalId} label="대여 ID" />
                    </InfoRow>
                    <InfoRow label="사용자">
                        <ValueLink to={`/users/${rental.userRef}/history`}>
                            {rental.userRef}
                        </ValueLink>
                    </InfoRow>
                    <InfoRow label="대여 대여소">
                        <ValueLink to={`/stations/${rental.stationId}`}>
                            {rental.stationName} ({rental.stationId})
                        </ValueLink>
                    </InfoRow>
                    <InfoRow label="슬롯">
                        <ValueLink to={`/slots/${rental.slotId}`}>{rental.slotLabel}</ValueLink>
                    </InfoRow>
                    <InfoRow label="대여 시각">{rental.rentedAt}</InfoRow>
                    <InfoRow label="반납 기한">{rental.dueAt}</InfoRow>
                    <InfoRow label="대여 상태">
                        <Badge tone={RENTAL_STATUS_TONE[rental.status]}>
                            {RENTAL_STATUS_LABEL[rental.status]}
                        </Badge>
                    </InfoRow>
                </InfoCard>

                <InfoCard title="반납 정보">
                    {linkedReturn ? (
                        <>
                            <InfoRow label="반납 시각">{linkedReturn.attemptedAt}</InfoRow>
                            <InfoRow label="반납 대여소">
                                <ValueLink to={`/stations/${linkedReturn.stationId}`}>
                                    {linkedReturn.stationName} ({linkedReturn.stationId})
                                </ValueLink>
                            </InfoRow>
                            <InfoRow label="반납 슬롯">
                                {linkedReturn.slotLabel ?? '슬롯 미선정'}
                            </InfoRow>
                            <InfoRow label="반납 처리">
                                <ValueLink to={`/history/returns/${linkedReturn.returnAttemptId}`}>
                                    {shortId(linkedReturn.returnAttemptId)}
                                </ValueLink>
                            </InfoRow>
                            <InfoRow label="연결 정산">
                                {linkedSettlement ? (
                                    <ValueLink
                                        to={`/history/settlements/${linkedSettlement.settlementId}`}
                                    >
                                        {shortId(linkedSettlement.settlementId)}
                                    </ValueLink>
                                ) : (
                                    <span className="text-brand-muted">없음</span>
                                )}
                            </InfoRow>
                        </>
                    ) : (
                        <div className="flex h-[210px] items-center justify-center text-[12.5px] font-medium text-brand-muted">
                            아직 완료된 반납이 없습니다.
                        </div>
                    )}
                </InfoCard>
            </div>

            <div className="mt-4">
                <Timeline
                    steps={[
                        { label: '대여', at: rental.rentedAt.slice(5), done: true },
                        {
                            label: '반납',
                            at: linkedReturn?.attemptedAt.slice(5) ?? '—',
                            done: Boolean(linkedReturn),
                        },
                        {
                            label: '반납 처리',
                            at: linkedReturn?.attemptedAt.slice(11) ?? '—',
                            done: Boolean(linkedReturn),
                        },
                        {
                            label: '정산',
                            at: linkedSettlement?.createdAt.slice(11) ?? '—',
                            done: Boolean(linkedSettlement),
                        },
                    ]}
                />
            </div>

            <DetailNote>
                대여 건에는 AI 검수가 없습니다. AI 검수·판정·정산은 반납 시점부터 발생하며 연결된
                반납 건에서 확인하세요. 연체 여부와 금액은 서버가 계산한 값을 그대로 표시합니다.
            </DetailNote>
        </div>
    );
}
