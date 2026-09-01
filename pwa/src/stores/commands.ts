// Cross-store orchestrator. Each store module below owns a *single* resource and
// only touches its own atom; anything that composes two or more stores for one
// user-facing action lives here. This keeps the store call graph acyclic: store
// modules never import a sibling store's action functions.
//
// Imports of `$catalog` / `$categories` are atom reads that let the commands
// drive the individual store *set*s directly (single-resource mutations stay in
// their owning module). No command writes history — add/remove from the list is
// the only history writer (see `./list`); `wipeAllData` resets the `$history`
// atom directly, which is a reset, not a history event.

// Type-only on purpose: local-data.ts imports `wipeAllData` from this module at
// runtime, so a value import would create a cycle. The envelope type is just
// the restore payload's shape.
import type { LocalDataEnvelope } from "@/lib/local-data"
import { DEFAULT_PALETTE_ID } from "@/lib/palettes"
import { $catalog, addCatalogItem, reassignItemsToCategory } from "./catalog"
import {
  $categories,
  ensureUncategorizedExists,
  normalizeCategoryColors,
  normalizeCategoryFrequencies,
} from "./categories"
import { $history } from "./history"
import { $list, addToList, removeListEntriesForItem } from "./list"
import { $onboarded, $selectedDatasetId } from "./onboarding"
import { $activePaletteId } from "./palette"
import { $installDismissed } from "./pwa-install"
import { $theme } from "./theme"
import { UNCATEGORIZED_ID } from "./types"
import { $accordionOpen, $selectedSort } from "./ui"
import { $user } from "./user"

// Deletes a category and reassigns its catalog items to the "uncategorized"
// sentinel. No history write. The sentinel itself cannot be deleted.
export function deleteCategoryWithReassign(id: string): void {
  if (id === UNCATEGORIZED_ID) return
  reassignItemsToCategory(id, UNCATEGORIZED_ID)
  $categories.set($categories.get().filter((c) => c.id !== id))
}

// Deletes a catalog item and cascades the active-list entries that reference it.
// Deliberately does NOT write history.
export function deleteCatalogItemWithCascade(id: string): void {
  $catalog.set($catalog.get().filter((item) => item.id !== id))
  removeListEntriesForItem(id)
}

// Convenience: create a brand-new catalog item and immediately add it to the
// active list (e.g. quick-add from the UI).
export function createItemAndAddToList(name: string, categoryId: string): void {
  const item = addCatalogItem(name, categoryId)
  addToList(item.id)
}

// Blank profile used by the factory wipe (moved here from lib/local-data.ts so
// the full reset lives with the other cross-store flows).
const EMPTY_USER = {
  username: "",
  firstName: "",
  lastName: "",
  email: "",
  avatar: "",
}

// Full factory wipe across every persisted store: resets each atom to its
// initial value, then clears all `remindit:` localStorage entries in one
// `clear()` (matching tests/fixtures/reset.ts — guarantees no residue). The
// theme preference is deliberately wiped too, unlike seedFromDataset/reset &
// reseed which preserve it. Callers should navigate or rely on the onboarding
// guard (router.tsx) redirecting to /onboarding once `$onboarded` is false.
export function wipeAllData(): void {
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

  localStorage.clear()
}

// Restore a downloaded backup (src/lib/local-data.ts): overwrite every
// persisted store with the envelope snapshot. Catalog/list/history rows arrive
// already validated + typed (the parser in local-data.ts drops or coerces
// them); this function only re-runs the category-level normalizers the seeding
// paths use (initStores / seedFromDataset) — sentinel category, frequency +
// color backfills. $onboarded is forced to true: a restored backup must never
// bounce the user back to the onboarding gate. Deliberately no
// localStorage.clear() — each persistent atom overwrites its own `remindit:`
// key on set, and clearing would also wipe the locale choice the backup didn't
// capture.
export function restoreLocalData(envelope: LocalDataEnvelope): void {
  $catalog.set(envelope.data.catalog)
  $categories.set(envelope.data.categories)
  $list.set(envelope.data.list)
  $history.set(envelope.data.history)
  $user.set(envelope.data.user)
  $theme.set(envelope.data.theme)
  $activePaletteId.set(envelope.data.activePalette)
  $selectedSort.set(envelope.data.selectedSort)
  $accordionOpen.set(envelope.data.accordionOpen)
  $onboarded.set(true)
  $selectedDatasetId.set(envelope.data.selectedDataset)
  $installDismissed.set(envelope.data.installDismissed)

  ensureUncategorizedExists()
  normalizeCategoryFrequencies()
  normalizeCategoryColors()
}
