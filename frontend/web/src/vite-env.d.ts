/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
    readonly VITE_APP_NAME: string;
    /** 'true' 면 로그인 없이 관리자 화면 진입 (로그인 미구현 구간용) */
    readonly VITE_AUTH_BYPASS?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
