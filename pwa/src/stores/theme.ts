import { persistentAtom } from "@nanostores/persistent"
import { atom, computed } from "nanostores"
import { STORAGE_KEYS } from "./persistence"

export type ThemeMode = "light" | "dark" | "system"

const DARK_QUERY = "(prefers-color-scheme: dark)"

// JSON-encoded like every other store (single serialization strategy). The
// decode tolerates legacy raw values written before serialization was unified,
// so existing persisted themes survive the migration instead of resetting.
export const $theme = persistentAtom<ThemeMode>(STORAGE_KEYS.theme, "system", {
  encode: JSON.stringify,
  decode: (value) => {
    try {
      return JSON.parse(value) as ThemeMode
    } catch {
      return value as ThemeMode
    }
  },
})

let mediaQuery: MediaQueryList | null = null
let initialized = false

// Tracks the OS color-scheme preference. A plain computed off $theme alone
// can't resolve "system" reactively: while in system mode an OS flip leaves
// the store value unchanged and only the matchMedia listener fires, so the
// resolved variant needs this second input to recompute.
const $systemDark = atom(false)

// The concrete light/dark variant the UI should render for the current mode +
// OS preference. Components that care about the resolved look (e.g. picking a
// theme-matched video asset) subscribe to this instead of $theme.
export const $themeVariant = computed(
  [$theme, $systemDark],
  (mode, systemDark): "light" | "dark" =>
    mode === "dark" || (mode === "system" && systemDark) ? "dark" : "light"
)

function getSystemDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches
}

function isDark(mode: ThemeMode): boolean {
  return mode === "dark" || (mode === "system" && getSystemDark())
}

function applyTheme(mode: ThemeMode): void {
  const dark = isDark(mode)
  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.style.colorScheme = dark ? "dark" : "light"
}

// Applies the active theme to <html> and keeps it in sync with both the store
// and the OS color-scheme preference. Safe to call once; a guard prevents
// duplicate subscriptions/listeners if invoked more than once.
export function initTheme(): void {
  if (initialized) return
  initialized = true

  // One apply handles both inputs: store changes and OS-preference flips.
  // Refreshing $systemDark here (not just applyTheme) is what keeps
  // $themeVariant reactive in "system" mode — the store value is unchanged on
  // an OS flip, so the $theme.subscribe below alone would never fire.
  const apply = () => {
    $systemDark.set(getSystemDark())
    applyTheme($theme.get())
  }
  apply()
  $theme.subscribe(apply)

  if (!mediaQuery) {
    mediaQuery = window.matchMedia(DARK_QUERY)
    // Re-applies when the OS preference flips while in "system" mode. The
    // store value is unchanged here, so the subscribe above won't fire.
    mediaQuery.addEventListener("change", apply)
  }
}
