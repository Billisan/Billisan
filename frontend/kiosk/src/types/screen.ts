export const SCREEN_ID = {
  MAIN: 'SCR-KSK-MAIN-001',
  AUTH: 'SCR-KSK-AUTH-001',
  RENT: 'SCR-KSK-RENT-001',
} as const

export type ScreenId = (typeof SCREEN_ID)[keyof typeof SCREEN_ID]
