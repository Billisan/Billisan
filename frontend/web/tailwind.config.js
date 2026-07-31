import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'],
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        container: {
            center: true,
            padding: '2rem',
            screens: {
                '2xl': '1400px',
            },
        },
        extend: {
            fontFamily: {
                sans: [
                    'Pretendard Variable',
                    'Pretendard',
                    '-apple-system',
                    'BlinkMacSystemFont',
                    'system-ui',
                    'Segoe UI',
                    'Apple SD Gothic Neo',
                    'Noto Sans KR',
                    'Malgun Gothic',
                    'sans-serif',
                ],
            },
            colors: {
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))',
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))',
                },
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))',
                },

                /**
                 * 빌리산 관리자 디자인 토큰.
                 * 디자인 시안(1280x800)에서 그대로 뽑은 값이라, 관리자 화면은 여기 것만 씁니다.
                 */
                brand: {
                    /** 사이드바 배경 (진한 네이비) */
                    navy: '#383F51',
                    /** 사이드바 hover */
                    'navy-hover': '#434B60',
                    /** 사이드바 배지 배경 */
                    'navy-badge': '#4C5468',
                    /** 사이드바 비활성 아이콘 */
                    'navy-icon': '#9BA4B8',
                    /** 사이드바 비활성 라벨 */
                    'navy-label': '#D3D8E3',
                    /** 포인트 블루 */
                    blue: '#2196F3',
                    /** 링크/강조 블루 (밝은 배경 위 대비 확보용) */
                    'blue-ink': '#0C7FDA',
                    /** 콘텐츠 영역 배경 */
                    canvas: '#EFF2F4',
                    /** 제목 텍스트 */
                    ink: '#1E252B',
                    /** 본문 텍스트 */
                    body: '#5D7285',
                    /** 보조 설명 텍스트 */
                    muted: '#9AA9B6',
                    /** placeholder 텍스트 */
                    placeholder: '#A6B0BB',
                    /** 헤더 하단 구분선 */
                    line: '#E1E7EC',
                    /** 카드 내부 구분선 */
                    'line-soft': '#EAEEF1',
                    /** 세로 구분선 */
                    divider: '#E6EBEF',
                    /** 검색창 배경 */
                    field: '#F3F5F8',
                    /** 바로가기 행 배경 */
                    surface: '#F4F6F8',
                    /** 프로그레스 트랙 */
                    track: '#EBEFF3',
                    /** 아웃라인 버튼·칩 테두리 */
                    'border-soft': '#DCE2E7',
                    /** 표 보조 텍스트(날짜 등) */
                    'ink-soft': '#3F4E5C',
                    /** 페이지 상단 메타 텍스트 */
                    'muted-strong': '#8C9AA8',
                },

                /**
                 * 배지·칩 톤.
                 * 상태 이름이 아니라 색 이름으로 두어, 상태→톤 매핑은 도메인 쪽에서 정합니다.
                 */
                tone: {
                    'green-bg': '#E4F5EC',
                    'green-fg': '#2FA36B',
                    'blue-bg': '#E9F5FE',
                    'blue-fg': '#0C7FDA',
                    'amber-bg': '#FDF1DF',
                    'amber-fg': '#D08A20',
                    'red-bg': '#FCE9E7',
                    'red-fg': '#E0574A',
                    'slate-bg': '#EAEEF1',
                    'slate-fg': '#5D7285',
                    /*
                     * 운영에서 빠진 상태(`이용 중지`)용.
                     *
                     * 원래는 `빈 슬롯`·`확인 필요`와 같은 회색이었는데, **빈 슬롯은 정상**
                     * (우산이 나가 있을 뿐)이고 **이용 중지는 사람이 손대야 하는 상태**라
                     * 같은 색이면 표에서 문제를 놓칩니다.
                     *
                     * 빨강은 `파손`이 이미 쓰고 있어서 보라를 씁니다. 초록·노랑·빨강의
                     * 신호등 축과 겹치지 않아 "정상/주의/위험"과 다른 갈래로 읽힙니다.
                     */
                    'violet-bg': '#EFEAFB',
                    'violet-fg': '#6B4FBB',
                },

                /** 대여소 재고 상태 색상 (부족/적정/과잉/오프라인) */
                status: {
                    shortage: '#E0574A',
                    normal: '#2FA36B',
                    surplus: '#2196F3',
                    offline: '#AEBAC5',
                    'offline-text': '#A9B4BF',
                },

                /** 지도 플레이스홀더 전용 색상 */
                map: {
                    base: '#EAEDF0',
                    park: '#DCEEDD',
                    water: '#D7E8F7',
                    block: '#E2E5E9',
                },
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
        },
    },
    plugins: [tailwindcssAnimate],
};
