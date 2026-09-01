// Unit tests for the PWA installability detection (src/lib/pwa-install).

import { afterEach, describe, expect, test } from "@rstest/core"
import {
  detectPlatform,
  isStandalone,
  type ManualInstallPlatform,
} from "@/lib/pwa-install"

const nav = navigator as Navigator & {
  userAgent: string
  platform?: string
  maxTouchPoints?: number
}

// We stub the read-only navigator fields with configurability so each case can
// drive the UA/platform/touch combination, then restore in afterEach.
const stubbed = new Set<keyof typeof nav>()

function setNav(overrides: {
  userAgent: string
  platform?: string
  maxTouchPoints?: number
}) {
  for (const key of ["userAgent", "platform", "maxTouchPoints"] as const) {
    const value = overrides[key] ?? (key === "userAgent" ? "" : 0)
    Object.defineProperty(nav, key, {
      value,
      configurable: true,
      writable: true,
    })
    stubbed.add(key)
  }
}

afterEach(() => {
  // Props were defined `configurable: true`, so delete restores the prototype
  // value. Reflect.deleteProperty takes plain `object` — no cast needed.
  for (const key of stubbed) Reflect.deleteProperty(nav, key)
  stubbed.clear()
})

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
const IPAD_UA =
  "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
const MAC_SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15"
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Mobile Safari/537.36"
const DESKTOP_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 Safari/537.36"

const cases: {
  name: string
  overrides: { userAgent: string; platform?: string; maxTouchPoints?: number }
  expected: ManualInstallPlatform
}[] = [
  { name: "iPhone", overrides: { userAgent: IPHONE_UA }, expected: "ios" },
  { name: "iPad", overrides: { userAgent: IPAD_UA }, expected: "ios" },
  {
    name: "iPadOS (Mac reporting with touch)",
    overrides: {
      userAgent: MAC_SAFARI_UA,
      platform: "MacIntel",
      maxTouchPoints: 5,
    },
    expected: "ios",
  },
  {
    name: "macOS Safari",
    overrides: {
      userAgent: MAC_SAFARI_UA,
      platform: "MacIntel",
      maxTouchPoints: 0,
    },
    expected: "mac-safari",
  },
  {
    name: "non-Chrome Android",
    overrides: { userAgent: ANDROID_UA, maxTouchPoints: 0 },
    expected: "android-nonchrome",
  },
  {
    name: "desktop Chrome",
    overrides: { userAgent: DESKTOP_UA, maxTouchPoints: 0 },
    expected: "other",
  },
]

describe("detectPlatform", () => {
  for (const c of cases) {
    test(`maps ${c.name} to ${c.expected}`, () => {
      setNav(c.overrides)
      expect(detectPlatform()).toBe(c.expected)
    })
  }
})

describe("isStandalone", () => {
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  test("is true in standalone display mode", () => {
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia

    expect(isStandalone()).toBe(true)
  })

  test("is false in a normal browser tab", () => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia

    expect(isStandalone()).toBe(false)
  })
})
