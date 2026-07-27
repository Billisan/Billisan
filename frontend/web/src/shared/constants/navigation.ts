import {
    ClipboardIcon,
    GridIcon,
    HomeIcon,
    ListIcon,
    MapPinIcon,
    ShieldCheckIcon,
    UmbrellaIcon,
    type NavIcon,
} from '@/components/layout/NavIcons';
import { OPERATION_SUMMARY } from '@/shared/constants/operationSummary';

export interface NavItem {
    label: string;
    to: string;
    icon: NavIcon;
    /** 우측 배지에 표시할 처리 대기 건수 (0 이면 숨김) */
    badge?: number;
}

/**
 * 관리자 사이드바 네비게이션.
 * 화면을 추가할 때는 여기에 등록하고 app/router.tsx 에 같은 경로를 연결하세요.
 * 헤더의 페이지 제목도 이 목록에서 가져다 씁니다.
 */
export const NAV_ITEMS: NavItem[] = [
    { label: '대시보드', to: '/', icon: HomeIcon },
    { label: '대여소 관리', to: '/stations', icon: GridIcon },
    { label: '우산 재고', to: '/umbrellas', icon: UmbrellaIcon },
    { label: '이력', to: '/history', icon: ListIcon },
    {
        label: '파손 검수',
        to: '/inspections',
        icon: ShieldCheckIcon,
        badge: OPERATION_SUMMARY.pendingInspections,
    },
    { label: '지도·분포도', to: '/map', icon: MapPinIcon },
    { label: '조치 이력', to: '/actions', icon: ClipboardIcon },
];

/** 현재 경로에 해당하는 네비게이션 항목 (헤더 제목용) */
export function findNavItem(pathname: string): NavItem | undefined {
    if (pathname === '/') {
        return NAV_ITEMS[0];
    }

    return NAV_ITEMS.find((item) => item.to !== '/' && pathname.startsWith(item.to));
}
