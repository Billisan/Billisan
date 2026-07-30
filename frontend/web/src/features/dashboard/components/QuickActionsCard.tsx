import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Panel } from '@/features/dashboard/components/Panel';
import { PanelState } from '@/features/dashboard/components/PanelState';
import { useSettlements } from '@/features/history/hooks/useHistory';
import { useInspectionList } from '@/features/inspections/hooks/useInspections';
import { cn } from '@/lib/utils';

/**
 * 대시보드의 처리 대기 바로가기.
 *
 * **숫자를 상수로 박아 두면 안 됩니다.** 예전에는 `5건`·`13건` 이 하드코딩이라
 * 검수를 판정하거나 정산을 처리해도 그대로였습니다. 관리자는 그 숫자를 보고 "아직
 * 5건 남았다"고 읽으니, 틀린 숫자는 없는 숫자보다 나쁩니다. 사이드바 배지도 같은
 * 이유로 걷어냈습니다.
 *
 * 그래서 목록이 실제로 보여 주는 것과 **같은 조회에서 셉니다.** 눌러서 들어간 화면의
 * 건수와 어긋나지 않습니다.
 *
 * TODO: 운영 집계 API(`WEB-API-CAND-001 · P1`)가 확정되면 그 값으로 바꾸세요. 지금
 *       방식은 목록을 받아 세는 것이라, 서버가 cursor 로 잘라 주기 시작하면 첫 쪽만
 *       셉니다. 검수는 그래서 size 를 넉넉히 잡아 둔 상태입니다.
 */

/** 조회가 끝나기 전에는 숫자 자리를 비웁니다. 0 을 먼저 보여 주면 "없다"로 읽힙니다. */
function CountBadge({ value }: { value: number | null }) {
    return (
        <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-brand-blue-ink">
            {value === null ? '—' : `${value}건`}
            <ArrowRight className="size-[13px]" aria-hidden />
        </span>
    );
}

export function QuickActionsCard({ className }: { className?: string }) {
    // 검수 목록과 같은 조건(미처리)으로 셉니다.
    const inspections = useInspectionList({ reviewStatus: 'PENDING', size: 100 });
    const settlements = useSettlements();

    const pendingInspections = inspections.data ? inspections.data.items.length : null;
    const pendingSettlements = settlements.data
        ? settlements.data.filter((item) => item.status === 'PENDING').length
        : null;

    /*
     * 조회가 실패하면 숫자 자리에 `—` 가 영원히 남습니다. 불러오는 중과 구분이 안 되고,
     * 눌러 들어가 봐야 뭐가 잘못됐는지 알게 됩니다. 이 영역만 다시 시도할 수 있게
     * 바꿔 끼웁니다 (화면흐름 §16).
     */
    const failed = inspections.isError || settlements.isError;
    const retry = () => {
        if (inspections.isError) void inspections.refetch();
        if (settlements.isError) void settlements.refetch();
    };

    const actions = [
        { label: '파손 검수 대기', count: pendingInspections, to: '/inspections?review=PENDING' },
        /*
         * 예전 목적지는 `/settlements` 였는데 빈 자리 화면이었습니다. 정산 관리는
         * `WEB-API-CAND-005 · P1` 미계약이고 화면흐름 §11.2 의 수동 처리도
         * `DEFERRED_NOT_CONTRACTED` 라 만들 근거가 없습니다.
         *
         * 대신 **이미 있는 정산 이력**의 미정산 필터로 보냅니다. 관리자가 실제로 하려던
         * 일(미정산이 뭔지 보기)은 그 화면에서 됩니다.
         */
        {
            label: '미정산 처리',
            count: pendingSettlements,
            to: '/history/settlements?status=PENDING',
        },
    ];

    if (failed) {
        return (
            <Panel className={cn('p-[18px]', className)}>
                <PanelState
                    pending={false}
                    failed
                    message="처리 대기 건수를 불러오지 못했습니다"
                    onRetry={retry}
                />
            </Panel>
        );
    }

    return (
        <Panel className={cn('gap-3 p-[18px]', className)}>
            {actions.map((action) => (
                <Link
                    key={action.to}
                    to={action.to}
                    className="flex h-11 items-center justify-between rounded-lg bg-brand-surface px-[14px] transition-colors hover:bg-brand-track"
                >
                    <span className="text-[12.5px] font-semibold text-brand-body">
                        {action.label}
                    </span>
                    <CountBadge value={action.count} />
                </Link>
            ))}
        </Panel>
    );
}
