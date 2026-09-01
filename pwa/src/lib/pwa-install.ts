// Pure PWA-installability detection. Extracted from stores/pwa-install.ts so the
// platform/standalone sniffing can be unit-tested directly. The store module
// keeps only the atom wiring and imports these helpers.

export type ManualInstallPlatform =
  | "ios"
  | "mac-safari"
  | "android-nonchrome"
  | "other"

// Detects the manual "Add to Home Screen" platform. Chromium exposes a native
// prompt (`beforeinstallprompt`); Safari/iOS/macOS and non-Chrome Android don't,
// so they get instructions instead.
export function detectPlatform(): ManualInstallPlatform {
  if (typeof navigator === "undefined") return "other"
  const ua = navigator.userAgent
  const isIOS =
    /iP(hone|ad|od)/.test(ua) ||
    // iPadOS reports as Mac with touch support.
    ((navigator.platform === "MacIntel" || /Macintosh/.test(ua)) &&
      navigator.maxTouchPoints > 1)
  const isMac = /Macintosh/.test(ua)
  const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua)
  const isAndroid = /android/i.test(ua)
  const isChrome = /chrome|crios|edg/i.test(ua)

  if (isIOS) return "ios"
  if (isMac && isSafari) return "mac-safari"
  if (isAndroid && !isChrome) return "android-nonchrome"
  return "other"
}

// True when the app is already running installed (standalone display mode or the
// legacy navigator.standalone flag).
export function isStandalone(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  const mq = window.matchMedia("(display-mode: standalone)")
  const navStandalone = (navigator as Navigator & { standalone?: boolean })
    .standalone
  return mq.matches || navStandalone === true
}
