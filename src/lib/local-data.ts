// Helpers for the "My local data" card in Profile.
//
// Download: serializes every persisted store into a single JSON envelope.
// Erase: wipes all `remindit:` data from localStorage and resets the in-memory
// stores so the onboarding guard (router.tsx) redirects to /onboarding.

import { DEFAULT_PALETTE_ID } from "@/lib/palettes"
import { $catalog } from "@/stores/catalog"
import { $categories } from "@/stores/categories"
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

const EMPTY_USER = {
  username: "",
  firstName: "",
  lastName: "",
  email: "",
  avatar: "",
}

/**
 * Erase all local data: reset every store to its initial value and clear
 * the persisted `localStorage`. This is a full factory wipe — including the
 * theme preference. The caller should navigate or let the onboarding guard
 * (`src/router.tsx` Layout) redirect to /onboarding via `$onboarded = false`.
 */
export function eraseLocalData(): void {
  $catalog.set([])
  $categories.set([])
  $list.set([])
  $history.set([])
  $user.set(EMPTY_USER)
  $theme.set("system")
  $activePaletteId.set(DEFAULT_PALETTE_ID)
  $selectedSort.set("default")
  $accordionOpen.set(null)
  $onboarded.set(false)
  $selectedDatasetId.set("")
  $installDismissed.set(false)

  // Remove the persisted entries. Iterate via STORAGE_KEYS semantics but
  // `clear()` guarantees no `remindit:` residue and matches
  // `tests/fixtures/reset.ts` behaviour for a full wipe.
  localStorage.clear()
}
