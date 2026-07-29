import {
    GridIcon,
    HomeIcon,
    ListIcon,
    MapPinIcon,
    ShieldCheckIcon,
    UmbrellaIcon,
    type NavIcon,
} from '@/components/layout/NavIcons';

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
    /*
     * 배지(대기 건수)를 뗐습니다.
     *
     * 값이 상수 `5` 로 박혀 있어서 실제 목록과 어긋났습니다 — 검수를 판정해도 5 그대로였고,
     * 관리자는 사이드바 숫자를 보고 "아직 5건 남았다"고 읽습니다. 틀린 숫자는 없는 숫자보다
     * 나쁩니다.
     *
     * 진짜로 살리려면 서버 집계가 필요한데, 관리자 10개에 그런 API 가 없습니다
     * (운영 대시보드는 `WEB-API-CAND-001 · P1` 미계약). 목록을 통째로 받아 세는 건
     * cursor 페이지네이션이라 첫 쪽밖에 못 셉니다.
     *
     * TODO: 집계 API 가 확정되면 그 값으로 되살리세요. 상수로는 되살리지 마세요.
     */
    { label: '파손 검수', to: '/inspections', icon: ShieldCheckIcon },
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
