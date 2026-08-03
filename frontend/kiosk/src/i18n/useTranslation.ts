import { useLanguageStore } from '../store/languageStore'
import { translations } from './translations'

export function useTranslation() {
  const language = useLanguageStore((state) => state.language)
  return translations[language]
}
