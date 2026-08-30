// PWA install prompt state.
//
// Wraps `pwa-install-handler` (which captures the browser `beforeinstallprompt`
// event) and exposes installability + "already installed" state through
// nanostores. Chromium browsers expose a native prompt via `canInstall()`;
// Safari/iOS/macOS and Android-non-Chrome don't fire that event, so for those we
// surface manual "Add to Home Screen" instructions instead (see
// `InstallInstructionsDialog`).
//
// `initPwaInstall()` wires the global listener exactly once. The module has no
// side effects on import (matching the stores barrel contract) — callers invoke
// `initPwaInstall()` from the app entry / layout.

import { atom, computed } from "nanostores"
import { pwaInstallHandler } from "pwa-install-handler"
import {
  detectPlatform,
  isStandalone,
  type ManualInstallPlatform,
} from "@/lib/pwa-install"
import { jsonStore, STORAGE_KEYS } from "./persistence"

// True once the browser offers a native install (Chromium `beforeinstallprompt`).
export const $canInstall = atom(false)
// True once the app is already running installed (standalone / added to home).
export const $installed = atom(false)
// User dismissed the banner — persisted so it never reappears (per product
// decision). Primer: a raw persistentAtom would store a string; the shared
// `jsonStore` keeps the boolean serialized as JSON consistently.
export const $installDismissed = jsonStore<boolean>(
  STORAGE_KEYS.installDismissed,
  false
)
// "Maybe later" dismissal for the current session only. Intentionally NOT
// persisted: it resets on the next app open so the prompt can reappear.
export const $installLater = atom(false)
// Which manual-install instructions to show when there is no native prompt.
export const $manualPlatform = atom<ManualInstallPlatform>("other")

let initialized = false

export function initPwaInstall(): void {
  if (initialized || typeof window === "undefined") return
  initialized = true

  $manualPlatform.set(detectPlatform())
  $installed.set(isStandalone())
  $canInstall.set(pwaInstallHandler.canInstall())

  window
    .matchMedia("(display-mode: standalone)")
    .addEventListener("change", (event) => {
      $installed.set(event.matches)
    })

  pwaInstallHandler.addListener((canInstall) => {
    $canInstall.set(canInstall)
  })
}

export function dismissInstall(): void {
  $installDismissed.set(true)
}

// Hides the banner for the rest of this session only ("Maybe later").
export function dismissLater(): void {
  $installLater.set(true)
}

// Triggers the native prompt. No-op (false) when the platform doesn't support
// it. Resolves true when the user accepted the install.
export async function installApp(): Promise<boolean> {
  if (!pwaInstallHandler.canInstall()) return false
  const installed = await pwaInstallHandler.install()
  if (installed) $installed.set(true)
  return installed
}

// Banner shows only for the native-prompt path and only while not installed or
// previously dismissed.
export const $showInstallBanner = computed(
  [$canInstall, $installed, $installDismissed, $installLater],
  (canInstall, installed, dismissed, later) =>
    canInstall && !installed && !dismissed && !later
)
