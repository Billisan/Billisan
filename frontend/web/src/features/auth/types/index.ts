/**
 * 관리자 인증 타입 — `ADMIN-AUTH-001/002/003` (API명세 B-2) · ERD `USER_ACCOUNT`.
 *
 * ERD 의 컬럼은 이게 전부입니다:
 *   `user_id uuid PK` · `login_id varchar UK` · `password_hash` · `name` · `role` ·
 *   `face_registered` · `created_at`
 *
 * 그래서 화면이 들고 있을 수 있는 관리자 정보도 딱 이만큼입니다.
 * `password_hash` 는 어떤 DTO·화면·로그에도 오지 않습니다. `student_number` 는 쓰지 않습니다.
 */

/** ERD `USER_ACCOUNT.role` 은 이 두 값뿐입니다. `SUPER_ADMIN` 같은 값은 없습니다. */
export type UserRole = 'USER' | 'ADMIN';

export interface AdminUser {
    /** ERD PK 는 UUID 입니다. 숫자 auto-increment 가 아닙니다. */
    userId: string;
    /** 대학 계정 형식 식별자. ERD 에 `email` 컬럼은 없습니다. */
    loginId: string;
    name: string;
    /** `ADMIN` 이 아니면 관리자 API 가 `403 ADMIN_ROLE_REQUIRED` 로 막습니다. */
    role: UserRole;
}

/**
 * `ADMIN-AUTH-001` 요청 본문.
 * 필드명이 `loginId` 입니다 — `email` 이 아닙니다 (B-2 요청 예시).
 */
export interface LoginRequest {
    loginId: string;
    password: string;
}

/**
 * `ADMIN-AUTH-001` 응답.
 *
 * 계약에 로그인 **응답** DTO 는 적혀 있지 않습니다. 그래서 `user` 를 선택 필드로 둡니다.
 * 응답에 있으면 그대로 쓰고, 없으면 이어서 `ADMIN-AUTH-003 /auth/me` 를 한 번 부릅니다.
 */
export interface LoginResponse {
    accessToken: string;
    user?: AdminUser;
    session?: SessionInfo;
}

/**
 * `ADMIN-AUTH-003` 이 주는 "세션 만료 정보".
 *
 * 서버가 만료 시각을 주면 그걸 씁니다. 없으면 클라이언트가 발급 시각 기준으로
 * 유휴 30분·절대 8시간을 셉니다 (`DEC-SESSION-001`).
 */
export interface SessionInfo {
    /** 절대 만료 시각 (ISO 문자열) */
    expiresAt?: string;
    /** 유휴 만료 시각 (ISO 문자열) */
    idleExpiresAt?: string;
}

/** `ADMIN-AUTH-003` 응답. user 를 그대로 주거나 `{user, session}` 으로 감싸 줄 수 있습니다. */
export type MeResponse = AdminUser | { user: AdminUser; session?: SessionInfo };
