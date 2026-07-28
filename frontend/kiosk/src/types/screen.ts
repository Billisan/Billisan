export const SCREEN_ID = {
  MAIN: 'SCR-KSK-MAIN-001',
} as const

export type ScreenId = (typeof SCREEN_ID)[keyof typeof SCREEN_ID]
