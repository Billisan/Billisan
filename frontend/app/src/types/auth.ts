export interface AuthUser {
  userId: string
  displayName: string
  schoolName: string
  faceRegistered: boolean
}

export interface LoginRequest {
  identifier: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresAt: string
  user: AuthUser
}
