import { create } from 'zustand'
import { SCREEN_ID, type ScreenId } from '../types/screen'

interface KioskFlowState {
  currentScreen: ScreenId
  goTo: (screen: ScreenId) => void
}

export const useKioskFlowStore = create<KioskFlowState>((set) => ({
  currentScreen: SCREEN_ID.MAIN,
  goTo: (screen) => set({ currentScreen: screen }),
}))
