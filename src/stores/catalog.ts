// Master pool of every known shopping item, grouped by category.
// Editing or deleting a catalog item must NOT touch history; only the active
// list's add/remove events are logged.

import { persistentJSON } from "@nanostores/persistent"
import { removeListEntriesForItem } from "./list"
import type { CatalogItem } from "./types"

const $catalog = persistentJSON<CatalogItem[]>("remindit:catalog", [])

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

// Removing a catalog item also drops any active list entries referencing it.
// Deliberately does NOT write history.
export function removeCatalogItem(id: string): void {
  $catalog.set($catalog.get().filter((item) => item.id !== id))
  removeListEntriesForItem(id)
}

export { $catalog }
