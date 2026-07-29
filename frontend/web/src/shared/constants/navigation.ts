import {
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
    /**
     * 활성 판정에 쓸 경로 접두사. 없으면 `to` 를 씁니다.
     * `이력` 처럼 링크는 첫 탭(`/history/rentals`)이지만 하위 경로 전체가 같은 메뉴인 경우에 씁니다.
     */
    match?: string;
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
    { label: '이력', to: '/history/rentals', match: '/history', icon: ListIcon },
    {
        label: '파손 검수',
        to: '/inspections',
        icon: ShieldCheckIcon,
        badge: OPERATION_SUMMARY.pendingInspections,
    },
    { label: '지도·분포도', to: '/map', icon: MapPinIcon },
    /*
     * `조치 이력` 은 뺐습니다. P0 관리자 API 10개 어디에도 없고, 12번 PART C 에서
     * `WEB-API-CAND-007 · P1/P2` 후보로만 남아 있으며 11번 §5 의 MVP 열이
     * `DEFERRED_NOT_CONTRACTED` 입니다(§14 · GAP-WEB-011 · DEC-WEB-005).
     * 무엇보다 08번 ERD §2.4 가 "모든 변경을 영구 감사 테이블로 복제하지 않는다"고 못 박았고
     * MySQL 업무 SSOT 10개 테이블에 조치 이력 테이블이 없습니다.
     * 감사 근거가 필요해지고 저장 방식이 정해지면 그때 되살리세요.
     */
];

/** 현재 경로에 해당하는 네비게이션 항목 (헤더 제목용) */
export function findNavItem(pathname: string): NavItem | undefined {
    if (pathname === '/') {
        return NAV_ITEMS[0];
    }

    return NAV_ITEMS.find((item) => item.to !== '/' && pathname.startsWith(item.match ?? item.to));
}
