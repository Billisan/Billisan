import {
    GridIcon,
    HomeIcon,
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
    /*
     * `이력`(대여·반납·정산) 은 **사이드바에서만 내렸습니다. 코드는 지우지 않았습니다.**
     *
     * 뒤에 목업밖에 없기 때문입니다. 관리자 API 8개에 대여·반납·정산이 없고
     * (`historyApi` 는 `env.useMockData` 분기조차 없이 무조건 목업을 돌려줍니다),
     * 화면 카탈로그상 전부 P1 입니다. 실 API 를 붙이면 재고·슬롯·검수는 진짜 데이터인데
     * 이 세 화면만 지어낸 값이 되고, **화면에는 그걸 알리는 표시가 없습니다.**
     * 시연에서 정산 이력을 열면 존재하지 않는 정산 건이 진짜처럼 보입니다.
     *
     * 되살리려면 이 줄만 다시 넣으세요 (라우트는 그대로 열려 있습니다):
     *   { label: '이력', to: '/history/rentals', match: '/history', icon: ListIcon },
     * (`ListIcon` 도 위 import 에 다시 추가해야 합니다)
     *
     * `features/history` 폴더는 그대로 둡니다 — 슬롯 상세가 `types.ts` 의
     * `RETURN_STATUS_LABEL`·`RETURN_STATUS_TONE` 을 쓰고 있어서입니다. 그쪽은 목업이
     * 아니라 **실 응답**(`SlotDetailResponse.latestReturnAttempt.status`)을 표시하는
     * 라벨이라, 지우면 실 API 화면이 깨집니다.
     */
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
    /*
     * `지도·분포도` 는 **화면에서만 내렸습니다. 코드는 지우지 않았습니다.**
     *
     * 되살리려면 이 줄만 다시 넣고 `app/router.tsx` 의 `/map` 라우트를 함께 여세요:
     *   { label: '지도·분포도', to: '/map', icon: MapPinIcon },
     * (`MapPinIcon` 도 위 import 에 다시 추가해야 합니다)
     *
     * `features/map` 폴더는 그대로 있습니다 — 대시보드의 대여소 분포도 카드가
     * `MapBackdrop` 을 계속 쓰고 있어서 지우면 대시보드가 깨집니다.
     */
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
