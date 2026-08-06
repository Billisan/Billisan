import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Panel } from '@/features/dashboard/components/Panel';
import { PanelState } from '@/features/dashboard/components/PanelState';
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
 * **「미정산 처리」를 뺐습니다.** 정산 조회 API 가 관리자 계약에 없어서 뒤에 목업밖에
 * 없었습니다(`historyApi` 는 실 API 분기조차 없습니다). 실 API 를 붙이면 검수 건수는
 * 진짜인데 미정산만 지어낸 값이고, 나란히 놓이면 둘 다 진짜로 읽힙니다. 위에서 "틀린
 * 숫자는 없는 숫자보다 나쁘다"고 한 것과 같은 이유입니다.
 * 되살리려면 정산 API 가 계약에 들어온 뒤에 하세요 — 목업으로는 되살리지 마세요.
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

    const pendingInspections = inspections.data ? inspections.data.items.length : null;

    /*
     * 조회가 실패하면 숫자 자리에 `—` 가 영원히 남습니다. 불러오는 중과 구분이 안 되고,
     * 눌러 들어가 봐야 뭐가 잘못됐는지 알게 됩니다. 이 영역만 다시 시도할 수 있게
     * 바꿔 끼웁니다 (화면흐름 §16).
     */
    const failed = inspections.isError;
    const retry = () => {
        if (inspections.isError) void inspections.refetch();
    };

    const actions = [
        { label: '파손 검수 대기', count: pendingInspections, to: '/inspections?review=PENDING' },
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
