/**
 * 환경 변수 접근 지점.
 * import.meta.env 를 직접 흩뿌리지 말고 여기서만 읽어서 타입 안전하게 사용합니다.
 */
export const env = {
    /**
     * 관리자 API 베이스 URL.
     *
     * 관리자 Web 이 부를 수 있는 경계는 `/api/v1/admin` 아래 10개뿐입니다 (API명세 B-1).
     * 그래서 baseURL 에 그 접두사까지 넣고, 각 API 는 `/auth/login` 처럼 짧게 씁니다.
     * dev 에서는 `/api` 로 시작하므로 vite.config.ts 의 프록시(-> localhost:8080)를 탑니다.
     */
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1/admin',
    /** 앱 표시 이름 */
    appName: import.meta.env.VITE_APP_NAME ?? '빌리산 관리자',
    /** 개발 모드 여부 */
    isDev: import.meta.env.DEV,
    /**
     * 로그인 없이 관리자 화면에 바로 진입할지 여부.
     *
     * **기본값을 false 로 내렸습니다.** 예전에는 개발 모드에서 true 라 로그인 화면을 아예
     * 지나쳤고, 그러면 `ADMIN-AUTH-001~003` 흐름을 확인할 수 없습니다.
     * 화면흐름 §15 도 "보호 라우트 진입 전 FE 가 세션 유무를 확인한다"고 합니다.
     */
    authBypass: import.meta.env.DEV && (import.meta.env.VITE_AUTH_BYPASS ?? 'false') === 'true',
    /**
     * 백엔드 없이 목업 계정으로 로그인할지 여부.
     * TODO: `ADMIN-AUTH-001 POST /api/v1/admin/auth/login` 이 붙으면 false 로 내리세요.
     */
    mockAuth: (import.meta.env.VITE_MOCK_AUTH ?? 'true') === 'true',
    /**
     * 인증 말고 **업무 데이터**를 목업으로 쓸지 여부.
     *
     * 로그인과 따로 두는 이유: 로그인이 먼저 붙고 재고·검수 API 는 나중에 붙습니다.
     * 그 사이에는 `VITE_MOCK_AUTH=false` + `VITE_USE_MOCK_DATA=true` 조합이 필요합니다.
     * 화면은 이 값을 보지 않습니다 — 각 도메인의 api 모듈 안에서만 갈립니다.
     */
    useMockData: (import.meta.env.VITE_USE_MOCK_DATA ?? 'true') === 'true',
    /** Public UI fixture values. Never supply real administrator credentials. */
    demoAdminId: import.meta.env.VITE_DEMO_ADMIN_ID ?? '',
    demoAdminPassword: import.meta.env.VITE_DEMO_ADMIN_PASSWORD ?? '',
} as const;
