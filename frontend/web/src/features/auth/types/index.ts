/** 관리자 사용자 */
export interface AdminUser {
    id: number;
    email: string;
    name: string;
    role: 'ADMIN' | 'SUPER_ADMIN';
}

/** 로그인 요청 바디 */
export interface LoginRequest {
    email: string;
    password: string;
}

/** 로그인 응답 data (백엔드 확정되면 필드 맞추기) */
export interface LoginResponse {
    accessToken: string;
    user: AdminUser;
}
