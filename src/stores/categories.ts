// Category definitions. Deleting a category reassigns its catalog items to the
// "uncategorized" sentinel rather than dropping them, and must NOT write
// history.

import { reassignItemsToCategory } from "./catalog"
import { jsonStore, STORAGE_KEYS } from "./persistence"
import { PALETTE_SLOT_COUNT } from "@/lib/category-palette"
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

// Smallest palette slot not yet used by `used`, or (once every slot is taken)
// `used.size % PALETTE_SLOT_COUNT` — reuse is then unavoidable with the current
// palette size.
function nextColorSlot(used: Set<number>): number {
  for (let i = 0; i < PALETTE_SLOT_COUNT; i++) {
    if (!used.has(i)) return i
  }
  return used.size % PALETTE_SLOT_COUNT
}

function usedColorSlots(categories: Category[]): Set<number> {
  const used = new Set<number>()
  for (const c of categories) {
    if (c.id === UNCATEGORIZED_ID) continue
    if (typeof c.color === "number") {
      used.add(((c.color % PALETTE_SLOT_COUNT) + PALETTE_SLOT_COUNT) % PALETTE_SLOT_COUNT)
    }
  }
  return used
}

/**
 * Return a copy of `categories` where every non-sentinel category carries a
 * distinct `color` slot (0..PALETTE_SLOT_COUNT-1). Existing valid slots are
 * kept; missing ones are filled with the smallest unused slot in category order,
 * so the assignment is a bijection for up to PALETTE_SLOT_COUNT categories and
 * stays stable across reloads.
 */
export function assignCategoryColors(categories: Category[]): Category[] {
  const used = usedColorSlots(categories)
  return categories.map((c) => {
    if (c.id === UNCATEGORIZED_ID) return c
    if (typeof c.color === "number") {
      const slot = ((c.color % PALETTE_SLOT_COUNT) + PALETTE_SLOT_COUNT) % PALETTE_SLOT_COUNT
      return c.color === slot ? c : { ...c, color: slot }
    }
    const slot = nextColorSlot(used)
    used.add(slot)
    return { ...c, color: slot }
  })
}

// Backfills a `color` slot onto any category missing one (e.g. data persisted
// before this field existed). Safe to call repeatedly; only writes on change.
export function normalizeCategoryColors(): void {
  const current = $categories.get()
  const next = assignCategoryColors(current)
  const changed = next.some((c, i) => c.color !== current[i]?.color)
  if (changed) $categories.set(next)
}

export function addCategory(
  name: string,
  frequency: CategoryFrequency = "unknown"
): Category {
  const slot = nextColorSlot(usedColorSlots($categories.get()))
  const category: Category = {
    id: crypto.randomUUID(),
    name: name.trim(),
    frequency,
    color: slot,
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
  const trimmed = name.trim()
  const category = getCategory(id)
  if (!category || trimmed.length === 0) return
  if (trimmed === category.name) return
  const categories = $categories.get()
  const index = categories.findIndex((c) => c.id === id)
  if (index === -1) return
  const next = categories.slice()
  next[index] = { ...next[index], name: trimmed }
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
