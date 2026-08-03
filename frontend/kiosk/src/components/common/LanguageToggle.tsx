import { useLanguageStore } from "../../store/languageStore";
import { GlobeIcon } from "../icons/GlobeIcon";

export function LanguageToggle() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  return (
    <div className="border-disabled flex items-center gap-3 rounded-full border bg-white py-2 pr-4 pl-6">
      <GlobeIcon className="h-7 w-7 text-black" />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setLanguage("ko")}
          className={`rounded-full px-5 py-2 text-xl font-bold transition-colors ${
            language === "ko" ? "bg-primary text-white" : "text-black"
          }`}
        >
          한국어
        </button>
        <button
          type="button"
          onClick={() => setLanguage("en")}
          className={`rounded-full px-5 py-2 text-xl font-bold transition-colors ${
            language === "en" ? "bg-primary text-white" : "text-black"
          }`}
        >
          Eng
        </button>
      </div>
    </div>
  );
}
