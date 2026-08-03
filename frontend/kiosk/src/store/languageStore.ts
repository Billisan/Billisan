import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import { create } from 'zustand'

export type Language = 'ko' | 'en'

interface LanguageState {
  language: Language
  setLanguage: (language: Language) => void
}

// 날짜/시간 표시(RentalCompleteScreen 등의 dayjs 포맷)도 언어 전환에 맞춰 오전/오후 ↔ AM/PM
// 등이 바뀌도록 dayjs 전역 locale을 여기서 함께 관리한다. 'en'은 dayjs 기본 locale이라
// 별도 import 없이 바로 사용 가능하다.
dayjs.locale('ko')

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'ko',
  setLanguage: (language) => {
    dayjs.locale(language)
    set({ language })
  },
}))
