import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { DecisionForm } from '@/features/inspections/components/DecisionForm';
import {
    AiResultBadge,
    NoImageNotice,
    ReviewStatusBadge,
    ScoreBar,
} from '@/features/inspections/components/InspectionParts';
import { useDecideInspection, useInspection } from '@/features/inspections/hooks/useInspections';
import type { InspectionDetail } from '@/features/inspections/types';
import {
    deriveSlotDisplayStatus,
    ITEM_CONDITION_TONE,
    SLOT_DISPLAY_TONE,
    slotStatusHint,
    slotStatusText,
} from '@/features/stations/types';
import { Badge } from '@/shared/components/Badge';
import {
    ITEM_CONDITION_LABEL,
    LOCK_STATUS_LABEL,
    OCCUPANCY_STATUS_LABEL,
    SLOT_SERVICE_LABEL,
} from '@/shared/constants/statusLabels';
import { PageBar } from '@/shared/components/PageBar';
import { ErrorState, LoadingState, NotFoundState } from '@/shared/components/PageState';
import { PageTitle } from '@/shared/components/PageTitle';

/**
 * 파손 검수 상세 — `SCR-WEB-INSPECTION-DETAIL-001` → `ADMIN-INSPECTION-002` · `003`.
 *
 * 시안(15번)은 대여소 상세 위에 뜨는 모달이지만, 여기서는 **페이지**입니다.
 * 판정은 슬롯 상태와 파손 정산을 한 트랜잭션으로 바꾸는 확정 행위라 주소가 남아야 하고,
 * 목록·슬롯 표·재고 세 군데에서 같은 화면으로 들어오기 때문입니다.
 *
 * 사진 자리는 두지 않습니다. 이미지는 원본·썸네일·URL·경로·key·Base64 어떤 형태로도
 * 내려오지 않습니다 (API명세 B-4.1 · D-2).
 */
export function InspectionDetailPage() {
    const { inspectionId } = useParams();
    const navigate = useNavigate();

    // ADMIN-INSPECTION-002. 판정이 성공하면 훅이 캐시를 무효화해 이 조회가 다시 돕니다
    // — 계약이 요구하는 "권위 상세 재조회"입니다 (화면흐름 §7.7 · API명세 B-5).
    const { data: detail, isPending, isError, error, refetch } = useInspection(inspectionId);
    const decide = useDecideInspection();

    if (isPending) {
        return (
            <div>
                <PageBar breadcrumb={[{ label: '파손 검수', to: '/inspections' }]} />
                <LoadingState />
            </div>
        );
    }

    /*
     * **조회 실패와 "없는 검수"를 갈라 말합니다.**
     *
     * 예전에는 둘 다 「존재하지 않는 검수입니다」였습니다. 서버가 500 을 줘도 화면은
     * 그렇게 단정했고, 관리자는 링크가 잘못된 줄 알고 찾기를 포기합니다. 실제로는 잠깐
     * 뒤에 다시 하면 되는 상황인데 다시 시도할 버튼조차 없었습니다.
     *
     * 검수 상세는 파손 판정으로 이어지는 화면이라, "없는 건" 과 "지금 못 읽는 것" 을
     * 뭉뚱그리면 관리자가 대응을 못 고릅니다.
     */
    if (isError) {
        return (
            <div>
                <PageBar breadcrumb={[{ label: '파손 검수', to: '/inspections' }]} />
                <ErrorState error={error} onRetry={() => void refetch()} />
            </div>
        );
    }

    if (!detail) {
        return (
            <div>
                <PageBar breadcrumb={[{ label: '파손 검수', to: '/inspections' }]} />
                <NotFoundState label="검수" id={inspectionId} />
            </div>
        );
    }

    // 화면에는 사람이 읽는 값을, 라우트·API 에는 UUID 를 씁니다.
    // 표시 보강(이름 명부)이 실패하면 축약 ID 로 버팁니다 (types 주석 참고).
    const slotLabel =
        detail.slotNumber != null
            ? `${detail.slotNumber}번 슬롯`
            : `슬롯 ${shortId(detail.slotId)}`;
    const stationLabel = detail.stationName ?? shortId(detail.stationId);

    return (
        <div>
            <PageBar
                breadcrumb={[
                    { label: '파손 검수', to: '/inspections' },
                    // 빵부스러기에 36자 UUID 를 그대로 깔면 줄이 넘칩니다. 앞 8자만 보여주고
                    // 전체 값은 아래 '검수 ID' 행에서 복사할 수 있게 둡니다.
                    { label: shortId(detail.inspectionId) },
                ]}
                meta={`최근 갱신 ${detail.updatedAt.slice(0, 10)} ${detail.updatedAt.slice(11, 16)}`}
            />

            {/* 요약 줄 */}
            <div className="mb-[18px] flex h-[58px] items-center rounded-lg bg-white pl-5 pr-4">
                <ReviewStatusBadge status={detail.reviewStatus} />
                <PageTitle className="ml-[14px] !text-[17px]" documentTitle={`${slotLabel} 검수`}>
                    {slotLabel}
                </PageTitle>
                <p className="ml-[8px] truncate text-[12px] font-medium text-brand-muted">
                    · {stationLabel}
                </p>
                <Link
                    to={`/slots/${detail.slotId}`}
                    className="ml-auto inline-flex h-[34px] items-center rounded-[7px] border border-brand-border-soft bg-white px-[14px] text-[12.5px] font-bold text-brand-body transition-colors hover:bg-brand-surface"
                >
                    슬롯 상세
                </Link>
            </div>

            <div className="grid grid-cols-2 items-start gap-[18px]">
                {/* 왼쪽 — AI 가 준 것 전부 */}
                <div className="space-y-[18px]">
                    <section className="rounded-lg bg-white px-5 pb-[18px] pt-[18px]">
                        <div className="flex items-center justify-between gap-4">
                            <h3 className="text-[14.5px] font-extrabold leading-none text-brand-ink">
                                AI 판정 결과
                            </h3>
                            <AiResultBadge result={detail.aiResult} />
                        </div>

                        <p className="mt-[10px] text-[11px] font-medium text-brand-muted">
                            보조 결과입니다. 이것만으로 파손이 확정되거나 과금되지 않습니다.
                        </p>

                        <div className="mt-[16px]">
                            <p className="text-[11.5px] font-semibold text-brand-body">신뢰도</p>
                            <ScoreBar
                                score={detail.aiScore}
                                result={detail.aiResult}
                                className="mt-[8px] w-full"
                            />
                        </div>

                        <dl className="mt-[18px]">
                            <MetaRow label="모델 버전">{detail.modelVersion}</MetaRow>
                            <MetaRow label="처리 시각">
                                {detail.processedAt.slice(5, 10)} {detail.processedAt.slice(11, 16)}
                            </MetaRow>
                        </dl>
                    </section>

                    <NoImageNotice />
                </div>

                {/* 오른쪽 — 식별자와 판정 */}
                <div className="space-y-[18px]">
                    <section className="rounded-lg bg-white px-5 pb-[18px] pt-[18px]">
                        <h3 className="text-[14.5px] font-extrabold leading-none text-brand-ink">
                            검수 정보
                        </h3>
                        <dl className="mt-[10px]">
                            {/* 전체 값을 남깁니다 — 백엔드 로그·문의 대조에 쓰는 값입니다. */}
                            <MetaRow label="검수 ID">
                                <span className="select-all font-mono text-[11px]">
                                    {detail.inspectionId}
                                </span>
                            </MetaRow>
                            <MetaRow label="반납 ID">{shortId(detail.returnAttemptId)}</MetaRow>
                            <MetaRow label="대여 ID">{shortId(detail.rentalId)}</MetaRow>
                            <MetaRow label="대여소">{stationLabel}</MetaRow>
                            <MetaRow label="슬롯">{slotLabel}</MetaRow>
                            <MetaRow label="최근 갱신">{detail.updatedAt.slice(11, 19)}</MetaRow>
                        </dl>
                    </section>

                    <SlotStateCard detail={detail} />

                    <DecisionForm
                        detail={detail}
                        onCancel={() => navigate('/inspections')}
                        pending={decide.isPending}
                        error={decide.error}
                        onSubmit={(input) =>
                            decide.mutate({ inspectionId: detail.inspectionId, input })
                        }
                    />
                </div>
            </div>

            <p className="mt-[18px] text-[11px] font-medium leading-[1.6] text-brand-muted">
                판정 저장은 검수·슬롯·정산을 한 트랜잭션으로 바꿉니다. 파손 확정만 파손 정산을
                만들고, 관리자가 정산완료로 직접 바꾸거나 금액을 손대지 않습니다.
            </p>
        </div>
    );
}

/**
 * 판정 시점의 슬롯 4축.
 *
 * `ADMIN-INSPECTION-002` 가 `slotOccupancyStatus` 등 네 축을 함께 주는데 화면에 안 그리고
 * 있었습니다. **이미지가 없는 판정 화면에서 이건 관리자가 가진 몇 안 되는 근거입니다** —
 * AI 결과와 신뢰도 말고는, 그 슬롯이 지금 어떤 상태로 잠겨 있는지가 판단 재료입니다.
 * 없으면 슬롯 상세로 넘어갔다 돌아와야 하고, 그 사이 판정 폼에 입력한 값이 날아갑니다.
 *
 * 배지는 `deriveSlotDisplayStatus` 로 뽑아 재고·슬롯 화면과 **같은 함수·같은 말**을 씁니다.
 * 네 축을 따로도 적는 이유는 파생 배지 하나로는 뭉개지는 정보가 있어서입니다 —
 * 「관리자 확인」 배지만으로는 우산이 들었는지, 잠겨 있는지 알 수 없습니다.
 */
function SlotStateCard({ detail }: { detail: InspectionDetail }) {
    const axes = {
        occupancyStatus: detail.slotOccupancyStatus,
        itemCondition: detail.slotItemCondition,
        serviceStatus: detail.slotServiceStatus,
        lockStatus: detail.slotLockStatus,
    };
    const display = deriveSlotDisplayStatus(axes);

    return (
        <section className="rounded-lg bg-white px-5 pb-[18px] pt-[18px]">
            <div className="flex items-center justify-between gap-4">
                <h3 className="text-[14.5px] font-extrabold leading-none text-brand-ink">
                    현재 슬롯 상태
                </h3>
                <Badge tone={SLOT_DISPLAY_TONE[display]} title={slotStatusHint(display)}>
                    {slotStatusText(display)}
                </Badge>
            </div>

            <dl className="mt-[10px]">
                <MetaRow label="점유">{OCCUPANCY_STATUS_LABEL[detail.slotOccupancyStatus]}</MetaRow>
                <MetaRow label="우산 상태">
                    {/* 슬롯 상세와 같은 배지·같은 톤을 씁니다 — 두 화면이 같은 말을 해야 합니다. */}
                    {detail.slotItemCondition ? (
                        <Badge tone={ITEM_CONDITION_TONE[detail.slotItemCondition]}>
                            {ITEM_CONDITION_LABEL[detail.slotItemCondition]}
                        </Badge>
                    ) : (
                        '—'
                    )}
                </MetaRow>
                <MetaRow label="서비스">{SLOT_SERVICE_LABEL[detail.slotServiceStatus]}</MetaRow>
                <MetaRow label="잠금">{LOCK_STATUS_LABEL[detail.slotLockStatus]}</MetaRow>
            </dl>

            <p className="mt-[8px] text-[11px] font-medium leading-[1.6] text-brand-muted">
                판정을 저장하면 이 상태가 함께 바뀝니다.
            </p>
        </section>
    );
}

/** UUID 앞 8자. 화면에서 건을 구분하는 데는 충분하고, 전체 값은 상세 행에 남습니다. */
function shortId(id: string): string {
    return `${id.slice(0, 8)}…`;
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex h-[34px] items-center justify-between gap-4">
            <dt className="shrink-0 text-[12px] font-medium text-brand-body">{label}</dt>
            <dd className="min-w-0 truncate text-right text-[12.5px] font-bold tabular-nums text-brand-ink">
                {children}
            </dd>
        </div>
    );
}
