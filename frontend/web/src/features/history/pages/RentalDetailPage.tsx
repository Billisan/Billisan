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
import { findReturn, findSettlement, HISTORY_SYNCED_AT } from '@/features/history/mocks/history';
import {
    RENTAL_STATUS_LABEL,
    RENTAL_STATUS_TONE,
    rentalDisplayStatus,
    REVIEW_STATUS_LABEL,
    SETTLEMENT_STATUS_LABEL,
} from '@/features/history/types';
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

    // 배지에 찍을 상태. 대여 중인데 기한이 지났으면 '연체'입니다 (화면흐름 §8.1).
    const display = rentalDisplayStatus(rental, HISTORY_SYNCED_AT);
    const linkedReturn = rental.returnAttemptId ? findReturn(rental.returnAttemptId) : undefined;
    const linkedSettlement = rental.settlementId ? findSettlement(rental.settlementId) : undefined;

    return (
        <div>
            <PageBar
                className="mb-[18px]"
                breadcrumb={[
                    { label: '이력', to: '/history/rentals' },
                    { label: '대여 이력', to: '/history/rentals' },
                    { label: shortId(rental.rentalId) },
                ]}
            />

            <DetailHeader
                tone={RENTAL_STATUS_TONE[display]}
                statusLabel={RENTAL_STATUS_LABEL[display]}
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
                            {shortId(rental.userRef)}
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
                        <Badge tone={RENTAL_STATUS_TONE[display]}>
                            {RENTAL_STATUS_LABEL[display]}
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
                            {/*
                             * 예전 이름이 '반납 처리' 였는데, 아래 타임라인의 '반납 처리'
                             * 단계(관리자 검수 판정)와 이름이 겹쳐서 한 화면에서 같은 말이
                             * 두 가지를 가리켰습니다. 이 행의 값은 반납 시도 ID 입니다.
                             */}
                            <InfoRow label="반납 시도 ID">
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
                        /*
                         * 관리자 검수 판정 단계입니다. 예전 이름 '반납 처리' 는 위 '대여 상태
                         * = 반납완료' 와 나란히 놓이면 "반납완료인데 반납 처리가 미처리" 라는
                         * 모순처럼 읽혔습니다. 반납(우산이 돌아온 것)과 검수(파손 판정)는
                         * 다른 일이라 이름으로 갈라 둡니다.
                         *
                         * 검수가 걸리지 않은 반납(AI 정상)은 판정할 게 없어 완료로 봅니다.
                         */
                        {
                            label: '관리자 검수',
                            at: linkedReturn
                                ? linkedReturn.reviewStatus === null
                                    ? '해당 없음'
                                    : REVIEW_STATUS_LABEL[linkedReturn.reviewStatus]
                                : '—',
                            done: Boolean(linkedReturn) && linkedReturn?.reviewStatus !== 'PENDING',
                        },
                        /*
                         * 정산 단계는 **결제까지 끝났을 때만** 완료입니다. 정산 행이 있으면
                         * 체크를 찍던 예전 코드는 미정산(PENDING)인데 돈을 받은 것처럼
                         * 보이게 했습니다. 정산 자체가 없는 건(무료 반납)은 '없음' 입니다.
                         */
                        {
                            label: '정산',
                            at: linkedSettlement
                                ? SETTLEMENT_STATUS_LABEL[linkedSettlement.status]
                                : '없음',
                            done: linkedSettlement?.status === 'PAID',
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
