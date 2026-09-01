/**
 * Locale metadata + switch helper for the app-level language feature.
 *
 * Paraglide owns persistence (localStorage strategy, key `remindit:locale`) and
 * locale resolution (localStorage → preferredLanguage → baseLocale). No
 * nanostore is needed: switching locales performs a full document reload, so
 * there is no reactive state to keep in sync (all app state is persisted).
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
 * `project.inlang/settings.json`, add `messages/{locale}.json`, then add an
 * entry here and run `bun run i18n:compile`.
 */
export const APP_LOCALES: readonly AppLocale[] = [
  { code: "en", nativeName: "English" },
  { code: "ro", nativeName: "Română" },
  // Later: German, French, Ukrainian (see docs/I18N-PLAN.md)
]

/** The currently active locale, resolved through the strategy chain. */
export function getActiveLocale(): Locale {
  return getLocale()
}

/**
 * Switch the UI language: persists the choice via the Paraglide strategy and
 * reloads the document in the new locale. Deliberate full reload (see
 * docs/I18N-PLAN.md) — the service-worker-served shell makes it fast and every
 * store is already persisted, so nothing is lost.
 */
export function setAppLocale(locale: Locale): void {
  if (locale === getLocale()) return
  void setLocale(locale)
}
