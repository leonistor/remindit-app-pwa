// Header language switcher — drives Paraglide's `setLocale`, which under the
// "url" strategy localizes the current URL and reloads (keeps the same page
// in the new language). The endonyms are proper nouns / data, not translatable
// copy — the pwa hardcodes the same list in `APP_LOCALES`.
import { getLocale, locales, setLocale } from "../paraglide/runtime"

const NATIVE_NAMES: Record<string, string> = {
  en: "English",
  ro: "Română",
  de: "Deutsch",
  fr: "Français",
  uk: "Українська",
}

export function LanguageSwitcher() {
  return (
    <label className="language-switcher">
      <span className="visually-hidden">Language</span>
      <select
        value={getLocale()}
        onChange={(event) => setLocale(event.target.value as (typeof locales)[number])}
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {NATIVE_NAMES[code] ?? code}
          </option>
        ))}
      </select>
    </label>
  )
}