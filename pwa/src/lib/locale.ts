/**
 * Locale metadata + switch helper for the app-level language feature.
 *
 * Paraglide owns persistence (localStorage strategy, key `remindit:locale`) and
 * locale resolution (localStorage → preferredLanguage → baseLocale). No
 * nanostore is needed: switching locales performs a full document reload, so
 * there is no reactive state to keep in sync (all app state is persisted).
 *
 * The translation catalog lives in `@remindit/common` (see
 * `pwa/scripts/compile-i18n.ts`); this module holds what's app-specific: the
 * locales offered to users.
 */

import type { Locale } from "@/paraglide/runtime"
import { getLocale, setLocale } from "@/paraglide/runtime"

export interface AppLocale {
  code: Locale
  /** Native name — always rendered in its own language, never translated. */
  nativeName: string
}

/**
 * Locales offered by the language pickers (onboarding step 1 + Profile), in
 * display order. Adding a language: register it in
 * `common/project.inlang/settings.json`, add `common/messages/{locale}.json`
 * (or kick-start a draft with `bun run kickstart:locale` in `common/`), then
 * add an entry here and run `bun run i18n:compile`.
 */
export const APP_LOCALES: readonly AppLocale[] = [
  { code: "en", nativeName: "English" },
  { code: "ro", nativeName: "Română" },
  { code: "de", nativeName: "Deutsch" },
  { code: "fr", nativeName: "Français" },
  { code: "uk", nativeName: "Українська" },
]

/** The currently active locale, resolved through the strategy chain. */
export function getActiveLocale(): Locale {
  return getLocale()
}

/**
 * Switch the UI language: persists the choice via the Paraglide strategy and
 * reloads the document in the new locale. Deliberate full reload — the
 * service-worker-served shell makes it fast and every
 * store is already persisted, so nothing is lost.
 */
export function setAppLocale(locale: Locale): void {
  if (locale === getLocale()) return
  void setLocale(locale)
}
