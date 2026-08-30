// Unit tests for the PWA install store (src/stores/pwa-install).
//
// `pwa-install-handler` is a singleton with no real prompt in happy-dom, so we
// stub its methods on the imported object to drive installability. We assert the
// banner-visibility contract (banner only shows for a native install that hasn't
// been installed or dismissed) plus the install/dismiss actions.

import { afterEach, beforeEach, describe, expect, it } from "@rstest/core"
import { pwaInstallHandler } from "pwa-install-handler"
import {
  $canInstall,
  $installDismissed,
  $installed,
  $showInstallBanner,
  dismissInstall,
  installApp,
} from "@/stores/pwa-install"

// Tracks whether the (stubbed) native prompt was actually triggered.
let installCalled = false

beforeEach(() => {
  localStorage.clear()
  installCalled = false
  $canInstall.set(false)
  $installed.set(false)
  $installDismissed.set(false)
  // The store reads matchMedia for standalone detection.
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
})

afterEach(() => {
  installCalled = false
})

describe("pwa install store", () => {
  it("hides the banner by default", () => {
    expect($showInstallBanner.get()).toBe(false)
  })

  it("shows the banner only when installable and not installed or dismissed", () => {
    $canInstall.set(true)
    expect($showInstallBanner.get()).toBe(true)

    $installed.set(true)
    expect($showInstallBanner.get()).toBe(false)

    $installed.set(false)
    $installDismissed.set(true)
    expect($showInstallBanner.get()).toBe(false)
  })

  it("persists dismissal and never shows the banner again", () => {
    $canInstall.set(true)
    dismissInstall()
    expect($installDismissed.get()).toBe(true)
    expect($showInstallBanner.get()).toBe(false)
  })

  it("triggers the native prompt and marks installed on accept", async () => {
    pwaInstallHandler.canInstall = () => true
    pwaInstallHandler.install = (async () => {
      installCalled = true
      return true
    }) as unknown as typeof pwaInstallHandler.install

    const result = await installApp()

    expect(installCalled).toBe(true)
    expect(result).toBe(true)
    expect($installed.get()).toBe(true)
  })

  it("is a no-op when the platform has no native prompt", async () => {
    pwaInstallHandler.canInstall = () => false
    pwaInstallHandler.install = (async () => {
      installCalled = true
      return true
    }) as unknown as typeof pwaInstallHandler.install

    const result = await installApp()

    expect(installCalled).toBe(false)
    expect(result).toBe(false)
  })
})
