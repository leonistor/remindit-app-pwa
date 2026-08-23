import { persistentAtom } from "@nanostores/persistent"

export type ThemeMode = "light" | "dark" | "system"

const DARK_QUERY = "(prefers-color-scheme: dark)"

export const themeStore = persistentAtom<ThemeMode>(
  "remindit:theme",
  "system",
  {}
)

let mediaQuery: MediaQueryList | null = null
let initialized = false

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

  const apply = () => applyTheme(themeStore.get())
  apply()
  themeStore.subscribe(apply)

  if (!mediaQuery) {
    mediaQuery = window.matchMedia(DARK_QUERY)
    // Re-applies when the OS preference flips while in "system" mode. The
    // store value is unchanged here, so the subscribe above won't fire.
    mediaQuery.addEventListener("change", apply)
  }
}
