// Master pool of every known shopping item, grouped by category.
// Single-resource store: every action here only mutates `$catalog`. Editing or
// deleting a catalog item must NOT touch history; only the active list's
// add/remove events are logged. Cross-store compositing (catalog deletion with
// a list cascade) lives in `./commands.ts`.

import { jsonStore, STORAGE_KEYS } from "./persistence"
import type { CatalogItem } from "./types"

const $catalog = jsonStore<CatalogItem[]>(STORAGE_KEYS.catalog, [])

export function getCatalogItem(id: string): CatalogItem | undefined {
  return $catalog.get().find((item) => item.id === id)
}

export function addCatalogItem(name: string, categoryId: string): CatalogItem {
  const item: CatalogItem = {
    id: crypto.randomUUID(),
    name: name.trim(),
    categoryId,
  }
  $catalog.set([...$catalog.get(), item])
  return item
}

export function updateCatalogItem(
  id: string,
  patch: Partial<Pick<CatalogItem, "name" | "categoryId">>
): void {
  const catalog = $catalog.get()
  const index = catalog.findIndex((item) => item.id === id)
  if (index === -1) return
  const current = catalog[index]
  const updated: CatalogItem = {
    ...current,
    ...patch,
    name: (patch.name ?? current.name).trim(),
  }
  const next = catalog.slice()
  next[index] = updated
  $catalog.set(next)
}

// Renames a catalog item in place. Convenience wrapper mirroring
// `renameCategory` so inline name editing has a symmetric, intent-revealing
// call. No-ops on an empty name or when the trimmed name is unchanged, to
// avoid blank items and needless `localStorage` writes.
export function renameCatalogItem(id: string, name: string): void {
  const trimmed = name.trim()
  const current = getCatalogItem(id)
  if (!current || trimmed.length === 0) return
  if (trimmed === current.name) return
  updateCatalogItem(id, { name: trimmed })
}

// Reassigns every catalog item currently in `fromId` to `toId`. Exposed so a
// category can be deleted without the categories store reaching into `$catalog`
// directly (see `deleteCategoryWithReassign` in `./commands.ts`). Does NOT write
// history.
export function reassignItemsToCategory(fromId: string, toId: string): void {
  const catalog = $catalog.get()
  const next = catalog.map((item) =>
    item.categoryId === fromId ? { ...item, categoryId: toId } : item
  )
  // Only write when something actually moved.
  if (
    next.some((item, index) => item.categoryId !== catalog[index].categoryId)
  ) {
    $catalog.set(next)
  }
}

export { $catalog }
