// Helpers for the "My local data" card in Profile.
//
// Download: serializes every persisted store into a single JSON envelope.
// Erase: delegates to `wipeAllData()` (src/stores/commands.ts) — the cross-store
// reset lives with the other store commands; this module only shapes the UI
// surface. The wipe clears all `remindit:` data and resets the in-memory stores
// so the onboarding guard (router.tsx) redirects to /onboarding.

import { $catalog } from "@/stores/catalog"
import { $categories } from "@/stores/categories"
import { wipeAllData } from "@/stores/commands"
import { $history } from "@/stores/history"
import { $list } from "@/stores/list"
import { $onboarded, $selectedDatasetId } from "@/stores/onboarding"
import { $activePaletteId } from "@/stores/palette"
import { $installDismissed } from "@/stores/pwa-install"
import { $theme } from "@/stores/theme"
import { $accordionOpen, $selectedSort } from "@/stores/ui"
import { $user } from "@/stores/user"
import { APP_VERSION } from "@/version"

export interface LocalDataEnvelope {
  /** App version at export time (from package.json via rsbuild define). */
  version: string
  /** ISO-8601 timestamp of the export. */
  exportedAt: string
  /** Snapshot of every persisted store. */
  data: {
    catalog: ReturnType<typeof $catalog.get>
    categories: ReturnType<typeof $categories.get>
    list: ReturnType<typeof $list.get>
    history: ReturnType<typeof $history.get>
    user: ReturnType<typeof $user.get>
    theme: ReturnType<typeof $theme.get>
    activePalette: ReturnType<typeof $activePaletteId.get>
    selectedSort: ReturnType<typeof $selectedSort.get>
    accordionOpen: ReturnType<typeof $accordionOpen.get>
    onboarded: ReturnType<typeof $onboarded.get>
    selectedDataset: ReturnType<typeof $selectedDatasetId.get>
    installDismissed: ReturnType<typeof $installDismissed.get>
  }
}

/** Collect a snapshot of all persisted stores. */
export function collectLocalData(): LocalDataEnvelope {
  return {
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      catalog: $catalog.get(),
      categories: $categories.get(),
      list: $list.get(),
      history: $history.get(),
      user: $user.get(),
      theme: $theme.get(),
      activePalette: $activePaletteId.get(),
      selectedSort: $selectedSort.get(),
      accordionOpen: $accordionOpen.get(),
      onboarded: $onboarded.get(),
      selectedDataset: $selectedDatasetId.get(),
      installDismissed: $installDismissed.get(),
    },
  }
}

/**
 * Trigger a browser download of the full local-data envelope.
 * Uses a Blob + object URL so no extra dependency is needed.
 */
export function downloadLocalData(): void {
  const envelope = collectLocalData()
  const json = JSON.stringify(envelope, null, 2)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const date = new Date().toISOString().slice(0, 10)
  const a = document.createElement("a")
  a.href = url
  a.download = `remindit-data-${date}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Erase all local data. A thin wrapper over `wipeAllData()` (the cross-store
 * command in src/stores/commands.ts) kept here so Profile's call site and the
 * "My local data" naming stay stable.
 */
export function eraseLocalData(): void {
  wipeAllData()
}
