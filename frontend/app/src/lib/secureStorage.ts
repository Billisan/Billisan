import * as SecureStore from 'expo-secure-store'

// accessToken 영속 저장 전용 래퍼. PROJECT_GUIDE.md §9.3 — accessToken은 로그·분석 이벤트에는
// 남기지 않되, SecureStore 저장 자체는 이 필드의 정상적인 용도다.
const ACCESS_TOKEN_KEY = 'billisan.accessToken'
const EXPIRES_AT_KEY = 'billisan.expiresAt'

export interface StoredSession {
  accessToken: string
  expiresAt: string
}

export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken)
  await SecureStore.setItemAsync(EXPIRES_AT_KEY, session.expiresAt)
}

export async function loadSession(): Promise<StoredSession | null> {
  const [accessToken, expiresAt] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(EXPIRES_AT_KEY),
  ])

  if (!accessToken || !expiresAt) return null

  return { accessToken, expiresAt }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY)
  await SecureStore.deleteItemAsync(EXPIRES_AT_KEY)
}
