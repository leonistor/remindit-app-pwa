// Cross-store orchestrator. Each store module below owns a *single* resource and
// only touches its own atom; anything that composes two or more stores for one
// user-facing action lives here. This keeps the store call graph acyclic: store
// modules never import a sibling store's action functions.
//
// Imports of `$catalog` / `$categories` are atom reads that let the commands
// drive the individual store *set*s directly (single-resource mutations stay in
// their owning module). No command writes history — add/remove from the list is
// the only history writer (see `./list`).

import { $catalog, addCatalogItem, reassignItemsToCategory } from "./catalog"
import { $categories } from "./categories"
import { addToList, removeListEntriesForItem } from "./list"
import { UNCATEGORIZED_ID } from "./types"

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
