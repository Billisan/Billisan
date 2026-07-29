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
    formatWon,
    outstandingOf,
    SETTLEMENT_REASON_LABEL,
    SETTLEMENT_REASON_TONE,
    SETTLEMENT_STATUS_LABEL,
    SETTLEMENT_STATUS_TONE,
} from '@/features/history/types';
import { Badge } from '@/shared/components/Badge';
import { PageBar } from '@/shared/components/PageBar';

/**
 * 정산 상세 — `SCR-WEB-SETTLEMENT-DETAIL-001` (**P1**, `WEB-API-CAND-007`).
 *
 * 시안의 버튼 두 개를 뺐습니다.
 * - **`정산 완료 처리`**: `WF-WEB-CHANGE-006` 이 "제거하고 현금 수납·면제·취소·정정이
 *   결정된 후 각각 명확한 액션으로 설계"하라고 합니다. Toss 승인과 같게 취급할 수 없고,
 *   §26.4 가 `관리자 임의 PAID 처리` 를 제외 계약으로 못 박았습니다.
 * - **`결제 요청 알림`**: `DEC-WEB-004` `DEFERRED_NOT_CONTRACTED` (채널·저장·중복 발송 미정).
 *
 * 그래서 이 화면은 **조회 전용**입니다. 조회는 `ADD_API_CANDIDATE`, 수동 처리·알림은
 * P0 계약이 없는 동안 계약 금지입니다 (§11.2).
 */
export function SettlementDetailPage() {
    const { settlementId } = useParams();
    const item = findSettlement(settlementId);

    if (!item) {
        return (
            <div>
                <PageBar breadcrumb={[{ label: '이력', to: '/history/settlements' }]} />
                <div className="flex h-[200px] items-center justify-center rounded-lg bg-white text-[13px] font-medium text-brand-muted">
                    존재하지 않는 정산입니다. ({settlementId})
                </div>
            </div>
        );
    }

    const paid = item.status === 'PAID';

    return (
        <div>
            <PageBar
                className="mb-6"
                breadcrumb={[
                    { label: '이력', to: '/history/settlements' },
                    { label: '정산 이력', to: '/history/settlements' },
                    { label: item.settlementId },
                ]}
            />

            <DetailHeader
                tone={SETTLEMENT_STATUS_TONE[item.status]}
                statusLabel={SETTLEMENT_STATUS_LABEL[item.status]}
                id={item.settlementId}
                actions={
                    <>
                        <DetailLinkButton to={`/history/rentals/${item.rentalId}`}>
                            연결 대여 보기
                        </DetailLinkButton>
                        {item.returnAttemptId && (
                            <DetailLinkButton to={`/history/returns/${item.returnAttemptId}`}>
                                연결 반납 보기
                            </DetailLinkButton>
                        )}
                    </>
                }
            />

            <div className="grid grid-cols-2 gap-4">
                <InfoCard title="정산 정보">
                    <InfoRow label="정산 ID">{item.settlementId}</InfoRow>
                    <InfoRow label="정산 유형">
                        <Badge tone={SETTLEMENT_REASON_TONE[item.reason]}>
                            {SETTLEMENT_REASON_LABEL[item.reason]}
                        </Badge>
                    </InfoRow>
                    <InfoRow label="금액">{formatWon(item.amount)}</InfoRow>
                    <InfoRow label="기결제액">{formatWon(item.paidAmount)}</InfoRow>
                    {/* outstandingAmount = amount - paidAmount (§11.1). 서버 값이 오면 그걸 씁니다. */}
                    <InfoRow label="미결제액">
                        <span className={outstandingOf(item) > 0 ? 'text-tone-red-fg' : undefined}>
                            {formatWon(outstandingOf(item))}
                        </span>
                    </InfoRow>
                    <InfoRow label="발생 시각">{item.createdAt}</InfoRow>
                    <InfoRow label="결제 일시">
                        {item.paidAt ?? <span className="text-brand-muted">—</span>}
                    </InfoRow>
                </InfoCard>

                <InfoCard title="대상 · 근거">
                    <InfoRow label="사용자">
                        <ValueLink to={`/users/${item.userRef}/history`}>{item.userRef}</ValueLink>
                    </InfoRow>
                    <InfoRow label="최종 판정">
                        {item.reason === 'DAMAGE' ? (
                            <Badge tone="red">DAMAGED</Badge>
                        ) : (
                            <span className="text-brand-muted">해당 없음</span>
                        )}
                    </InfoRow>
                    <InfoRow label="판정 사유">
                        {item.decisionReason ?? <span className="text-brand-muted">—</span>}
                    </InfoRow>
                    <InfoRow label="연결 반납">
                        {item.returnAttemptId ? (
                            <ValueLink to={`/history/returns/${item.returnAttemptId}`}>
                                {item.returnAttemptId}
                            </ValueLink>
                        ) : (
                            <span className="text-brand-muted">없음</span>
                        )}
                    </InfoRow>
                    <InfoRow label="연결 대여">
                        <ValueLink to={`/history/rentals/${item.rentalId}`}>
                            {item.rentalId}
                        </ValueLink>
                    </InfoRow>
                    <InfoRow label="대상 슬롯">
                        {item.slotId ?? <span className="text-brand-muted">—</span>}
                    </InfoRow>
                </InfoCard>
            </div>

            <div className="mt-4">
                <Timeline
                    steps={[
                        {
                            label: item.reason === 'DAMAGE' ? '파손 판정' : '사유 확정',
                            at: item.createdAt.slice(11),
                            done: true,
                        },
                        { label: '정산 발생', at: item.createdAt.slice(11), done: true },
                        {
                            label: '결제',
                            at: item.paidAt?.slice(11) ?? '대기 중',
                            done: paid,
                        },
                        { label: '정산 완료', at: item.paidAt?.slice(11) ?? '—', done: paid },
                    ]}
                />
            </div>

            <DetailNote>
                이 화면은 조회 전용입니다. 관리자가 결제 완료를 직접 만들 수 없고, 현금 수납·면제·
                취소·정정 중 무엇인지 정해진 뒤에야 각각의 액션으로 설계합니다. 결제 요청 알림도
                채널·중복 발송 정책이 확정되기 전까지 두지 않습니다.
            </DetailNote>
        </div>
    );
}
