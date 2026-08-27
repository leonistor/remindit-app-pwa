// Category definitions. Deleting a category reassigns its catalog items to the
// "uncategorized" sentinel rather than dropping them, and must NOT write
// history.

import { reassignItemsToCategory } from "./catalog"
import { jsonStore, STORAGE_KEYS } from "./persistence"
import type { Category, CategoryFrequency } from "./types"
import {
  CATEGORY_FREQUENCIES,
  UNCATEGORIZED_ID,
  UNCATEGORIZED_NAME,
} from "./types"

const $categories = jsonStore<Category[]>(STORAGE_KEYS.categories, [])

export function getCategory(id: string): Category | undefined {
  return $categories.get().find((c) => c.id === id)
}

export function addCategory(
  name: string,
  frequency: CategoryFrequency = "unknown"
): Category {
  const category: Category = {
    id: crypto.randomUUID(),
    name: name.trim(),
    frequency,
  }
  $categories.set([...$categories.get(), category])
  return category
}

// Backfills a valid `frequency` onto any category that is missing one or carries
// a value outside `CATEGORY_FREQUENCIES` (e.g. data persisted before this field
// existed). Safe to call repeatedly; only writes when something changed.
export function normalizeCategoryFrequencies(): void {
  const categories = $categories.get()
  let changed = false
  const next = categories.map((category) => {
    if (!CATEGORY_FREQUENCIES.includes(category.frequency)) {
      changed = true
      return { ...category, frequency: "unknown" as CategoryFrequency }
    }
    return category
  })
  if (changed) $categories.set(next)
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

// Updates a category's name and/or purchase frequency. The sentinel category
// cannot be renamed. No history write.
export function updateCategory(
  id: string,
  patch: { name?: string; frequency?: CategoryFrequency }
): void {
  if (id === UNCATEGORIZED_ID) return
  const categories = $categories.get()
  const index = categories.findIndex((c) => c.id === id)
  if (index === -1) return
  const next = categories.slice()
  next[index] = {
    ...next[index],
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.frequency !== undefined ? { frequency: patch.frequency } : {}),
  }
  $categories.set(next)
}

// Deletes a category and reassigns its catalog items to "uncategorized".
// No history write. The sentinel category itself cannot be deleted.
export function removeCategory(id: string): void {
  if (id === UNCATEGORIZED_ID) return
  reassignItemsToCategory(id, UNCATEGORIZED_ID)
  $categories.set($categories.get().filter((c) => c.id !== id))
}

export function ensureUncategorizedExists(): void {
  const exists = $categories.get().some((c) => c.id === UNCATEGORIZED_ID)
  if (!exists) {
    $categories.set([
      { id: UNCATEGORIZED_ID, name: UNCATEGORIZED_NAME, frequency: "unknown" },
      ...$categories.get(),
    ])
  }
}

export { $categories }
