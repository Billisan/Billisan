/**
 * 환경 변수 접근 지점.
 * import.meta.env 를 직접 흩뿌리지 말고 여기서만 읽어서 타입 안전하게 사용합니다.
 */
export const env = {
    /** 백엔드 API 베이스 URL (예: '/api' 또는 'https://api.billisan.com') */
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
    /** 앱 표시 이름 */
    appName: import.meta.env.VITE_APP_NAME ?? '빌리산 관리자',
    /** 개발 모드 여부 */
    isDev: import.meta.env.DEV,
    /**
     * 로그인 없이 관리자 화면에 바로 진입할지 여부.
     *
     * 로그인 API 가 아직 없어서 개발 모드에서는 기본 true 입니다.
     * 실제 로그인이 붙으면 .env 에 VITE_AUTH_BYPASS=false 를 넣거나 이 플래그를 제거하세요.
     */
    authBypass: (import.meta.env.VITE_AUTH_BYPASS ?? String(import.meta.env.DEV)) === 'true',
} as const;
