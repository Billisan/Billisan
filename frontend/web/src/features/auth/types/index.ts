/**
 * 관리자 인증 — `ADMIN-AUTH-001/002/003` (12-R PART B-3).
 *
 * 세 API 의 `data` 는 **평평한 구조**입니다. `user` 나 `session` 으로 감싸지 않습니다.
 *
 * 응답에 **이름(`name`) 필드가 없습니다.** 관리자를 화면에 표시할 때 쓸 수 있는 건
 * `loginId` 뿐입니다. ERD `USER_ACCOUNT.name` 은 있지만 관리자 DTO 로 내려오지 않습니다.
 *
 * `password`, Bearer token, 이미지, 얼굴 정보는 로그·오류·응답 DTO 어디에도 담기지 않습니다 (B-2).
 */

/** 관리자 API 응답의 `role` 은 항상 `ADMIN` 입니다. 다른 값이면 서버가 403 으로 막습니다. */
export type AdminRole = 'ADMIN';

/** 인증된 관리자 신원. 세 API 가 같은 필드를 돌려줍니다. */
export interface AdminIdentity {
    /** `adminId` — UUID. ERD `USER_ACCOUNT.user_id` 에 대응합니다. */
    adminId: string;
    /** 대학 계정 형식 식별자. 화면에 보여줄 수 있는 유일한 관리자 표시값입니다. */
    loginId: string;
    role: AdminRole;
}

/**
 * 서버가 소유하는 세션 만료 시각. 둘 다 필수(O)입니다.
 *
 * `idleExpiresAt` 은 서버가 요청을 받을 때마다 밀어 줍니다. 클라이언트는 그 값을 갱신할 수
 * 없으므로, 화면 쪽 유휴 판정은 로컬 활동 시각으로 따로 셉니다 (`authStore`).
 */
export interface SessionExpiry {
    /** 마지막 활동 기준 30분 유휴 만료 예정 시각 */
    idleExpiresAt: string;
    /** 로그인 기준 최대 8시간 절대 만료 시각 */
    absoluteExpiresAt: string;
}

/** `ADMIN-AUTH-001` 요청 본문. 필드명은 `loginId` 입니다 — `email` 이 아닙니다. */
export interface LoginRequest {
    loginId: string;
    password: string;
}

/** `ADMIN-AUTH-001` 응답 `data` */
export interface LoginResponse extends AdminIdentity, SessionExpiry {
    /** 응답 후 로그·브라우저 영속 저장 금지 */
    accessToken: string;
    tokenType: 'Bearer';
}

/** `ADMIN-AUTH-003` 응답 `data` */
export type MeResponse = AdminIdentity & SessionExpiry;

/** `ADMIN-AUTH-002` 응답 `data`. 같은 세션에 반복 요청해도 `true` 입니다 (멱등). */
export interface LogoutResponse {
    loggedOut: boolean;
}
