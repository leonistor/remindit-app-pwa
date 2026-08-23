// Category definitions. Deleting a category reassigns its catalog items to the
// "uncategorized" sentinel rather than dropping them, and must NOT write
// history.

import { persistentJSON } from "@nanostores/persistent"
import { $catalog } from "./catalog"
import type { Category } from "./types"
import { UNCATEGORIZED_ID, UNCATEGORIZED_NAME } from "./types"

const $categories = persistentJSON<Category[]>("remindit:categories", [])

export function getCategory(id: string): Category | undefined {
  return $categories.get().find((c) => c.id === id)
}

export function addCategory(name: string): Category {
  const category: Category = {
    id: crypto.randomUUID(),
    name: name.trim(),
  }
  $categories.set([...$categories.get(), category])
  return category
}

export function renameCategory(id: string, name: string): void {
  if (id === UNCATEGORIZED_ID) return
  const categories = $categories.get()
  const index = categories.findIndex((c) => c.id === id)
  if (index === -1) return
  const next = categories.slice()
  next[index] = { ...next[index], name: name.trim() }
  $categories.set(next)
}

// Deletes a category and reassigns its catalog items to "uncategorized".
// No history write. The sentinel category itself cannot be deleted.
export function removeCategory(id: string): void {
  if (id === UNCATEGORIZED_ID) return
  const reassigned = $catalog
    .get()
    .map((item) =>
      item.categoryId === id ? { ...item, categoryId: UNCATEGORIZED_ID } : item
    )
  $catalog.set(reassigned)
  $categories.set($categories.get().filter((c) => c.id !== id))
}

export function ensureUncategorizedExists(): void {
  const exists = $categories.get().some((c) => c.id === UNCATEGORIZED_ID)
  if (!exists) {
    $categories.set([
      { id: UNCATEGORIZED_ID, name: UNCATEGORIZED_NAME },
      ...$categories.get(),
    ])
  }
}

export { $categories }
