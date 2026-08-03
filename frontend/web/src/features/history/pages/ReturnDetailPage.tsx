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
import { AiResultBadge } from '@/features/inspections/components/InspectionParts';
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
    /*
     * 추론이 결과를 만들어 냈는지. `FAILED` 는 ERD ai_result 정의상 "촬영·추론·통신 오류로
     * 판정 결과를 생성하지 못한" 경우라, 이때는 AI 검수가 끝난 게 아닙니다.
     */
    const inferenceDone = item.aiResult !== 'FAILED';
    /*
     * 반납 자체가 끝났는지. 타임라인에 이 단계가 없어서 **반납이 깨진 건도 그냥 통과**했습니다.
     * `복구 필요` 인데 관리자 검수·정산까지 흘러가 "다 끝났다" 로 보였습니다.
     */
    const returnSettled = item.status === 'COMPLETED';
    /*
     * 사람이 손대야만 풀리는 상태.
     *
     * ERD 부팅 복구 흐름의 마지막이 "관리자 확인 및 상태 보정" 이고, §8.1 이
     * "`RECOVERY_REQUIRED` 는 별도 복구 테이블이 아니라 반납·슬롯 상태로 표현한다" 고 해서
     * 이 화면이 복구 대상을 찾는 유일한 경로입니다. 그런데 파손 검수(`reviewStatus`)와는
     * **다른 축**이라, AI 가 정상이면 검수는 `해당 없음` 이 맞습니다. 그래서 검수 칸만 보면
     * 할 일이 없어 보입니다 — 조치 안내를 따로 띄웁니다.
     */
    const needsRecovery = item.status === 'RECOVERY_REQUIRED';
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
                        {/*
                         * 검수 상세로 보냅니다. 예전에는 `/slots/${item.slotId}` 였는데
                         * 슬롯을 못 고른 실패 반납에서는 그 값이 `null` 이라 `/slots/null`
                         * 로 링크돼 "존재하지 않는 슬롯" 이 떴습니다. 검수는 슬롯 없이도
                         * 존재하고(ERD §9.2-2 가 슬롯 배정보다 먼저 저장), 이 버튼이 가려는
                         * 곳도 슬롯이 아니라 검수입니다.
                         */}
                        {item.inspectionId && (
                            <DetailLinkButton to={`/inspections/${item.inspectionId}`} primary>
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
                        <ValueLink to={`/stations/${item.stationId}`}>{item.stationName}</ValueLink>
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
                    {/*
                     * 목록과 **같은 배지 컴포넌트**를 씁니다. 예전에는 여기만 `item.aiResult`
                     * 코드 원문(`FAILED`)을 그대로 찍어서, 목록은 한글인데 상세는 영문이었습니다.
                     * ERD §2.4.1 — "관리자 웹의 배지·표·상세 화면은 한글 명칭 우선",
                     * "API·DB·로그 값을 화면에 직접 노출하지 않고 공통 상태 라벨 매핑을 통해 변환"
                     */}
                    <InfoRow label="판정 결과">
                        <AiResultBadge result={item.aiResult} />
                    </InfoRow>
                    {/* 추론 실패면 점수가 없습니다. 0.00 으로 보이면 "확신 없음" 으로 오해합니다. */}
                    <InfoRow label="신뢰도">
                        {item.aiScore === null ? '측정 불가' : item.aiScore.toFixed(2)}
                    </InfoRow>
                    {/*
                     * 「모델 버전」은 뺐습니다 — 검수 상세와 같은 이유입니다.
                     * 관리자가 모델 이름으로 판단을 바꾸지 않고, 특정 모델의 판정 건을 모아
                     * 보는 일은 목록 필터(`modelVersion`)가 할 일입니다.
                     * 응답 필드(`item.modelVersion`)는 그대로 있어 언제든 되살릴 수 있습니다.
                     */}
                    <InfoRow label="추론 지연">{item.latencyMs}ms</InfoRow>
                    {/*
                     * 이미지 존재 여부·장수 대신 '처리했고 원본은 남기지 않았다'만 남깁니다.
                     *
                     * 문구를 고정해 두면 안 됩니다. `aiResult = FAILED` 는 "촬영·추론·통신
                     * 오류로 판정 결과를 생성하지 못한" 경우라, 그때 '추론 완료' 라고 적으면
                     * 옆 칸의 「검수 실패」·「측정 불가」와 정면으로 어긋납니다.
                     */}
                    <InfoRow label="촬영 처리">
                        {inferenceDone
                            ? '촬영·추론 완료 / 원본 미저장'
                            : '추론 미완료 / 원본 미저장'}
                    </InfoRow>
                    <InfoRow label="관리자 검수">
                        {reviewPending ? (
                            <span className="text-tone-amber-fg">{reviewLabel}</span>
                        ) : (
                            reviewLabel
                        )}
                    </InfoRow>
                </InfoCard>
            </div>

            {/*
             * 복구 안내.
             *
             * 「복구 필요」 는 파손 검수와 **다른 축**이라, AI 가 정상이면 관리자 검수 칸은
             * `해당 없음` 이 맞습니다. 그래서 검수 칸만 보면 할 일이 없어 보이는데, 실제로는
             * **사람이 손대야만 풀리는 상태**입니다. 그 간극을 이 안내가 메웁니다.
             *
             * 관리자 Web 은 장치를 못 만집니다(12-R B-1: 장치 제어 금지). 할 수 있는 일은
             * 현장에서 실물을 확인하고 슬롯 상태를 확정하는 것뿐이라, 슬롯 상세로 보냅니다.
             */}
            {needsRecovery && (
                <div
                    role="alert"
                    className="mt-4 rounded-lg bg-tone-red-bg px-5 py-[16px] text-[12.5px] font-medium leading-[20px] text-tone-red-fg"
                >
                    <p className="font-bold">관리자 조치가 필요합니다</p>
                    <p className="mt-[6px]">
                        우산은 슬롯에 들어갔지만 서버 반영이 끝나지 않아 물리 상태와 기록이 어긋난
                        건입니다. 사용자는 반납했다고 보는데 기록은 대여 중이라, 두면 연체 정산이
                        붙습니다. 슬롯도 함께 격리돼 있습니다.
                    </p>
                    {item.slotId ? (
                        <p className="mt-[8px]">
                            현장에서 실물을 확인한 뒤{' '}
                            <ValueLink to={`/slots/${item.slotId}`}>
                                {item.slotLabel ?? '연결 슬롯'}
                            </ValueLink>
                            에서 상태를 확정해 주세요.
                        </p>
                    ) : (
                        <p className="mt-[8px]">
                            반납 슬롯이 정해지기 전에 어긋난 건이라 연결된 슬롯이 없습니다. 대여소
                            장치 상태를 먼저 확인해 주세요.
                        </p>
                    )}
                </div>
            )}

            <div className="mt-4">
                <Timeline
                    steps={[
                        { label: '반납 접수', at: item.attemptedAt.slice(11), done: true },
                        /*
                         * AI 검수 단계는 **추론이 실제로 끝났을 때만** 완료입니다. 예전에는
                         * `done: true` 로 박혀 있어서, 추론이 실패한 건에도 체크가 찍혔습니다.
                         */
                        {
                            label: 'AI 검수',
                            at: inferenceDone ? item.attemptedAt.slice(11) : '검수 실패',
                            done: inferenceDone,
                        },
                        /*
                         * 반납이 실제로 끝났는지. `물리 완료`·`복구 필요`·`실패` 는 여기서
                         * 끊깁니다. 이 단계가 없으면 깨진 반납도 뒤 단계로 흘러갑니다.
                         */
                        {
                            label: '반납 완료',
                            at: returnSettled
                                ? item.attemptedAt.slice(11)
                                : RETURN_STATUS_LABEL[item.status],
                            done: returnSettled,
                        },
                        {
                            label: '관리자 검수',
                            at: reviewLabel,
                            done: returnSettled && !reviewPending,
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
                            done: returnSettled && settlement?.status === 'PAID',
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
