// Unit tests for the theme store (src/stores/theme).
//
// The test environment is happy-dom, which provides `localStorage` and
// `document.documentElement` out of the box. `window.matchMedia` is mocked
// per-test so we can deterministically drive the "system" branch of
// initTheme().
//
// We import the submodule directly (NOT the `@/stores` barrel) to avoid
// unrelated side effects, and we avoid `vi` (it is neither a static export of
// `@rstest/core` nor an auto-injected global in this project's config).

import { afterEach, beforeEach, describe, expect, test } from "@rstest/core"
import {
  $theme,
  $themeVariant,
  initTheme,
  type ThemeMode,
} from "@/stores/theme"

// Controllable OS dark-mode flag read by the mocked matchMedia.
let osPrefersDark = false

// Listeners registered on the mocked dark-scheme media query. initTheme()
// subscribes exactly once (module-level guard), so this stays populated for
// the whole file — dispatching these is how tests simulate the OS flipping
// its preference while the app is running.
const changeListeners: Array<() => void> = []

// Minimal MediaQueryList mock compatible with what initTheme() touches.
function makeMatchMedia() {
  return (query: string) => ({
    matches: query === "(prefers-color-scheme: dark)" ? osPrefersDark : false,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => {
      changeListeners.push(listener)
    },
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}

// Flips the mocked OS preference and fires the change listeners initTheme()
// registered, exercising the same code path a real OS flip would take.
function dispatchSystemDark(dark: boolean): void {
  osPrefersDark = dark
  for (const listener of changeListeners) listener()
}

const originalMatchMedia = window.matchMedia

// Helper that keeps the imported `ThemeMode` type in use and makes intent clear.
const setMode = (mode: ThemeMode) => $theme.set(mode)

beforeEach(() => {
  osPrefersDark = false
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: makeMatchMedia(),
  })
  localStorage.clear()
  document.documentElement.classList.remove("dark")
  document.documentElement.style.colorScheme = ""
})

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: originalMatchMedia,
  })
})

describe("$theme", () => {
  test("defaults to 'system' when nothing is persisted", () => {
    expect($theme.get()).toBe("system")
  })

  test("round-trips a value through localStorage", () => {
    setMode("dark")
    expect($theme.get()).toBe("dark")

    // Every store now uses JSON serialization, so the persisted key is the
    // JSON-encoded string, not a raw value.
    expect(localStorage.getItem("remindit:theme")).toBe(JSON.stringify("dark"))

    // Reset back to the default so other tests start clean.
    setMode("system")
    expect($theme.get()).toBe("system")
    expect(localStorage.getItem("remindit:theme")).toBe(
      JSON.stringify("system")
    )
  })
})

describe("initTheme", () => {
  // initTheme() guards against running twice via a module-level `initialized`
  // flag, but it subscribes to the store on first run. Every subsequent
  // $theme.set re-applies the theme, so we can drive all scenarios through
  // the store + the mocked OS preference without re-invoking initTheme.

  test("applies light mode without the .dark class", () => {
    setMode("light")
    initTheme()

    expect(document.documentElement.classList.contains("dark")).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe("light")
  })

  test("applies dark mode with the .dark class", () => {
    setMode("dark")
    initTheme()

    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe("dark")
  })

  test("treats system mode as dark when the OS prefers dark", () => {
    osPrefersDark = true
    setMode("system")
    initTheme()

    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  test("treats system mode as light when the OS prefers light", () => {
    osPrefersDark = false
    setMode("system")
    initTheme()

    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })
})

describe("$themeVariant", () => {
  // initTheme() has already run in the describe above (module-level guard),
  // so $systemDark is wired to the mocked matchMedia and updates via
  // dispatchSystemDark, exactly like a real OS-preference flip.

  test("resolves light and dark modes directly", () => {
    setMode("light")
    expect($themeVariant.get()).toBe("light")

    setMode("dark")
    expect($themeVariant.get()).toBe("dark")
  })

  test("system mode resolves from the OS preference", () => {
    dispatchSystemDark(false)
    setMode("system")
    expect($themeVariant.get()).toBe("light")

    dispatchSystemDark(true)
    expect($themeVariant.get()).toBe("dark")

    // Back to light so later tests don't inherit a dark-resolved variant.
    dispatchSystemDark(false)
    expect($themeVariant.get()).toBe("light")
  })
})
