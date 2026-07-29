import { QuickActionsCard } from '@/features/dashboard/components/QuickActionsCard';
import { StationMapCard } from '@/features/dashboard/components/StationMapCard';
import { StationStockCard } from '@/features/dashboard/components/StationStockCard';

/**
 * 관리자 대시보드.
 * 좌측 대여소 분포도 + 우측(재고 순위 / 처리 대기 바로가기) 구성입니다.
 * 대여소 데이터는 features/stations 의 목업을 공유합니다.
 */
export function DashboardPage() {
    return (
        <div className="flex h-full min-h-[628px] flex-col gap-[18px] xl:flex-row">
            <StationMapCard className="min-w-0 flex-1" />

            <div className="flex w-full shrink-0 flex-col gap-4 xl:w-[296px]">
                <StationStockCard className="min-h-0 flex-1" />
                <QuickActionsCard />
            </div>
        </div>
    );
}
